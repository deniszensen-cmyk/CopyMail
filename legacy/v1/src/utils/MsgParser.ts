/**
 * Browser-native .msg file parser (Outlook Compound File Binary / OLE2 format).
 * No Node.js dependencies — works entirely with ArrayBuffer/DataView.
 *
 * Reference: https://docs.microsoft.com/en-us/openspecs/exchange_server_protocols/ms-oxmsg
 */

import type { EmailData } from './EmailProcessor';

// ---- MAPI Property IDs we care about ----
const PR_SUBJECT        = 0x0037;
const PR_SENDER_NAME    = 0x0C1A;
const PR_SENDER_EMAIL   = 0x0C1F;
const PR_SENT_REPR_NAME = 0x0042;
const PR_SENT_REPR_EMAIL= 0x0065;
const PR_RECEIVED_BY_NAME = 0x0040;
const PR_CLIENT_SUBMIT_TIME = 0x0039;
const PR_MESSAGE_DELIVERY_TIME = 0x0E06;
const PR_BODY           = 0x1000;
const PR_BODY_HTML      = 0x1013;
const PR_DISPLAY_TO     = 0x0E04;

// Property type constants
const PT_UNICODE = 0x001F;
const PT_STRING8 = 0x001E;
const PT_SYSTIME = 0x0040;

// ---- OLE2 / CFB Structures ----
const SECTOR_SIZE = 512;
const MINI_SECTOR_SIZE = 64;
const MINI_STREAM_CUTOFF = 4096;

export async function parseMsgBuffer(buffer: ArrayBuffer): Promise<EmailData> {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  // Verify OLE2 magic: D0 CF 11 E0 A1 B1 1A E1
  const magic = [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1];
  for (let i = 0; i < 8; i++) {
    if (bytes[i] !== magic[i]) throw new Error('Keine gültige .msg-Datei (falsches Magic)');
  }

  const sectorSize = 1 << view.getUint16(30, true); // usually 512
  const miniFAT_cutoff = view.getUint32(56, true);   // usually 4096
  const firstDirSector = view.getUint32(48, true);
  const firstMiniFAT = view.getUint32(60, true);
  const numMiniFAT = view.getUint32(64, true);
  const firstDIFAT = view.getUint32(68, true);
  const numDIFAT = view.getUint32(72, true);

  // Build FAT chain from DIFAT
  const DIFAT: number[] = [];
  // First 109 FAT sectors are in header at offset 76
  for (let i = 0; i < 109; i++) {
    const sec = view.getUint32(76 + i * 4, true);
    if (sec >= 0xFFFFFFFE) break;
    DIFAT.push(sec);
  }
  // Additional DIFAT sectors (rarely needed for typical .msg files)
  let difatSec = firstDIFAT;
  for (let d = 0; d < numDIFAT && difatSec < 0xFFFFFFFE; d++) {
    const off = sectorOffset(difatSec, sectorSize);
    for (let i = 0; i < (sectorSize / 4) - 1; i++) {
      const sec = view.getUint32(off + i * 4, true);
      if (sec >= 0xFFFFFFFE) break;
      DIFAT.push(sec);
    }
    difatSec = view.getUint32(off + sectorSize - 4, true);
  }

  // Build FAT
  const fat: number[] = [];
  for (const sec of DIFAT) {
    const off = sectorOffset(sec, sectorSize);
    for (let i = 0; i < sectorSize / 4; i++) {
      fat.push(view.getUint32(off + i * 4, true));
    }
  }

  // Helper: read a chain of sectors
  function readChain(startSector: number): Uint8Array {
    const chunks: Uint8Array[] = [];
    let sec = startSector;
    while (sec < 0xFFFFFFFE) {
      const off = sectorOffset(sec, sectorSize);
      chunks.push(bytes.slice(off, off + sectorSize));
      sec = fat[sec] ?? 0xFFFFFFFE;
    }
    return concatU8(chunks);
  }

  // Read directory entries
  const dirData = readChain(firstDirSector);
  const dirView = new DataView(dirData.buffer);
  const entries: DirEntry[] = [];
  for (let i = 0; i * 128 < dirData.length; i++) {
    const base = i * 128;
    const nameLen = dirView.getUint16(base + 64, true);
    const rawName = nameLen > 2
      ? decodeUTF16LE(dirData.slice(base, base + nameLen - 2))
      : '';
    const entryType = dirData[base + 66];
    const startSec = dirView.getUint32(base + 116, true);
    const size = dirView.getUint32(base + 120, true);
    const child = dirView.getUint32(base + 76, true);
    const left = dirView.getUint32(base + 68, true);
    const right = dirView.getUint32(base + 72, true);
    entries.push({ name: rawName, type: entryType, startSec, size, child, left, right });
  }

  // Build mini-stream (root entry child chain)
  const rootEntry = entries[0];
  const miniStreamData = readChain(rootEntry.startSec);

  // Build mini-FAT
  let miniFATData: Uint8Array = new Uint8Array(0);
  if (numMiniFAT > 0 && firstMiniFAT < 0xFFFFFFFE) {
    miniFATData = readChain(firstMiniFAT);
  }
  const miniFATView = new DataView(miniFATData.buffer);

  function readMiniChain(startSector: number, size: number): Uint8Array {
    const chunks: Uint8Array[] = [];
    let sec = startSector;
    while (sec < 0xFFFFFFFE) {
      const off = sec * MINI_SECTOR_SIZE;
      chunks.push(miniStreamData.slice(off, off + MINI_SECTOR_SIZE));
      if (miniFATData.length >= (sec + 1) * 4) {
        sec = miniFATView.getUint32(sec * 4, true);
      } else {
        break;
      }
    }
    const full = concatU8(chunks);
    return full.slice(0, size);
  }

  function readEntry(entry: DirEntry): Uint8Array {
    if (entry.size < miniFAT_cutoff && entry.startSec < 0xFFFFFFFE) {
      return readMiniChain(entry.startSec, entry.size);
    } else if (entry.startSec < 0xFFFFFFFE) {
      const chain = readChain(entry.startSec);
      return chain.slice(0, entry.size);
    }
    return new Uint8Array(0);
  }

  // Index entries by name
  const entryMap = new Map<string, DirEntry>();
  for (const e of entries) {
    if (e.name) entryMap.set(e.name.toLowerCase(), e);
  }

  // Parse MAPI properties from __properties_version1.0
  const propsEntry = entryMap.get('__properties_version1.0');
  const props = new Map<number, { type: number; data: Uint8Array }>();

  if (propsEntry) {
    const pData = readEntry(propsEntry);
    const pView = new DataView(pData.buffer, pData.byteOffset, pData.byteLength);
    // Root properties header is 32 bytes, then 16 bytes per property
    const headerSize = 32;
    for (let i = headerSize; i + 16 <= pData.length; i += 16) {
      const propType = pView.getUint16(i, true);
      const propId = pView.getUint16(i + 2, true);
      const value = pData.slice(i + 8, i + 16);
      props.set(propId | (propType << 16), { type: propType, data: value });
    }
  }

  // Helper: get string property (from stream)
  function getStrProp(propId: number): string {
    // Try Unicode first
    const keyU = `__substg1.0_${hex4(propId)}${hex4(PT_UNICODE)}`.toLowerCase();
    const keyA = `__substg1.0_${hex4(propId)}${hex4(PT_STRING8)}`.toLowerCase();
    const eU = entryMap.get(keyU);
    if (eU) return decodeUTF16LE(readEntry(eU));
    const eA = entryMap.get(keyA);
    if (eA) return new TextDecoder('windows-1252').decode(readEntry(eA));
    return '';
  }

  // Helper: get datetime property
  function getTimeProp(propId: number): string {
    const keyT = `__substg1.0_${hex4(propId)}${hex4(PT_SYSTIME)}`.toLowerCase();
    // SYSTIME is stored as fixed-size in __properties
    const propKey = propId | (PT_SYSTIME << 16);
    const p = props.get(propKey);
    if (p) {
      // Windows FILETIME: 100-nanosecond intervals since Jan 1, 1601
      const dv = new DataView(p.data.buffer, p.data.byteOffset, p.data.byteLength);
      const lo = dv.getUint32(0, true);
      const hi = dv.getUint32(4, true);
      const ft = hi * 4294967296 + lo;
      const ms = ft / 10000 - 11644473600000;
      if (ms > 0) return new Date(ms).toISOString();
    }
    return '';
  }

  // Extract all values
  const subject   = getStrProp(PR_SUBJECT);
  const senderName  = getStrProp(PR_SENDER_NAME) || getStrProp(PR_SENT_REPR_NAME);
  const senderEmail = getStrProp(PR_SENDER_EMAIL) || getStrProp(PR_SENT_REPR_EMAIL);
  const displayTo   = getStrProp(PR_DISPLAY_TO) || getStrProp(PR_RECEIVED_BY_NAME);
  const body        = getStrProp(PR_BODY);
  const date        = getTimeProp(PR_CLIENT_SUBMIT_TIME) || getTimeProp(PR_MESSAGE_DELIVERY_TIME);

  // HTML body — stored differently (MIME stream or direct)
  let bodyHtml: string | undefined;
  const htmlKey  = `__substg1.0_${hex4(PR_BODY_HTML)}${hex4(PT_UNICODE)}`.toLowerCase();
  const htmlKeyA = `__substg1.0_${hex4(PR_BODY_HTML)}${hex4(PT_STRING8)}`.toLowerCase();
  const htmlEntryU = entryMap.get(htmlKey);
  const htmlEntryA = entryMap.get(htmlKeyA);
  if (htmlEntryU) {
    bodyHtml = decodeUTF16LE(readEntry(htmlEntryU));
  } else if (htmlEntryA) {
    bodyHtml = new TextDecoder('windows-1252').decode(readEntry(htmlEntryA));
  }

  const from = senderName && senderEmail
    ? `${senderName} <${senderEmail}>`
    : senderName || senderEmail || 'Unbekannt';

  // Extract all recipients from substorages (PR_RECIPIENT_DISPLAY_NAME = 0x3001)
  const allRecips: string[] = [];
  for (const [key, entry] of entryMap.entries()) {
    if (key.includes('3001001f')) { // PR_RECIPIENT_DISPLAY_NAME as Unicode
      const name = decodeUTF16LE(readEntry(entry));
      if (name && !allRecips.includes(name)) allRecips.push(name);
    }
  }
  const to = allRecips.length > 0 ? allRecips.join('; ') : (displayTo || 'Unbekannt');

  return {
    from,
    to,
    date: date || new Date().toISOString(),
    subject: subject || '(Kein Betreff)',
    body,
    bodyHtml: bodyHtml || undefined,
  };
}

// ---- Helpers ----

interface DirEntry {
  name: string;
  type: number;
  startSec: number;
  size: number;
  child: number;
  left: number;
  right: number;
}

function sectorOffset(sector: number, sectorSize: number): number {
  return (sector + 1) * sectorSize;
}

function concatU8(arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrays) { out.set(a, off); off += a.length; }
  return out;
}

function decodeUTF16LE(data: Uint8Array): string {
  const decoder = new TextDecoder('utf-16le');
  return decoder.decode(data);
}

function hex4(n: number): string {
  return n.toString(16).toUpperCase().padStart(4, '0');
}

function hex8(n: number): string {
  return n.toString(16).toUpperCase().padStart(8, '0');
}
