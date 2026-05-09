using System;
using System.Collections.Generic;
using System.Collections.Specialized;
using System.IO;
using System.Text;
using System.Web.Script.Serialization;
using System.Windows.Forms;

namespace CopyMailClipboard
{
    internal sealed class ClipboardPayload
    {
        public string Text { get; set; }
        public string Html { get; set; }
        public string FilePath { get; set; }
        public List<string> FilePaths { get; set; }
    }

    internal static class Program
    {
        private const int MaxStdinBytes = 25 * 1024 * 1024;

        [STAThread]
        private static int Main(string[] args)
        {
            // Self-Test-Modus überspringt die normale Pipeline und prüft die
            // HTML-Clipboard-Format-Berechnung gegen Referenz-Werte. Wird vom
            // build.ps1-Skript optional nach dem Build ausgeführt.
            if (args != null && args.Length > 0 && args[0] == "--self-test")
            {
                return RunSelfTest();
            }

            try
            {
                string input = ReadStdinBounded(MaxStdinBytes);
                if (string.IsNullOrWhiteSpace(input))
                {
                    Console.Error.WriteLine("Empty payload.");
                    return 4;
                }

                var serializer = new JavaScriptSerializer();
                serializer.MaxJsonLength = MaxStdinBytes;

                ClipboardPayload payload;
                try
                {
                    payload = serializer.Deserialize<ClipboardPayload>(input);
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine("Invalid JSON: " + ex.Message);
                    return 5;
                }

                if (payload == null)
                {
                    Console.Error.WriteLine("No clipboard payload received.");
                    return 2;
                }

                var data = new DataObject();

                // Datei-Liste zusammenstellen (FilePath legacy + FilePaths)
                var paths = new List<string>();
                if (!string.IsNullOrWhiteSpace(payload.FilePath))
                {
                    paths.Add(payload.FilePath);
                }
                if (payload.FilePaths != null)
                {
                    foreach (var p in payload.FilePaths)
                    {
                        if (!string.IsNullOrWhiteSpace(p)) paths.Add(p);
                    }
                }

                if (paths.Count > 0)
                {
                    var files = new StringCollection();
                    foreach (var raw in paths)
                    {
                        var fullPath = Path.GetFullPath(raw);
                        if (!File.Exists(fullPath))
                        {
                            Console.Error.WriteLine("File not found: " + fullPath);
                            return 3;
                        }
                        files.Add(fullPath);
                    }
                    data.SetFileDropList(files);

                    if (string.IsNullOrWhiteSpace(payload.Text))
                    {
                        // Wenn kein Text mitkommt, schreibe wenigstens den ersten Pfad
                        // als Unicode-Text (für Apps, die FileDrop nicht akzeptieren).
                        data.SetText(files[0], TextDataFormat.UnicodeText);
                    }
                }

                if (!string.IsNullOrWhiteSpace(payload.Html))
                {
                    data.SetData(DataFormats.Html, BuildClipboardHtml(payload.Html));
                }

                if (!string.IsNullOrWhiteSpace(payload.Text))
                {
                    data.SetText(payload.Text, TextDataFormat.UnicodeText);
                    data.SetText(payload.Text, TextDataFormat.Text);
                }

                Clipboard.SetDataObject(data, true, 10, 50);
                return 0;
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine(ex.ToString());
                return 1;
            }
        }

        private static string ReadStdinBounded(int maxBytes)
        {
            using (var input = Console.OpenStandardInput())
            using (var memory = new MemoryStream())
            {
                var buffer = new byte[8192];
                int read;
                while ((read = input.Read(buffer, 0, buffer.Length)) > 0)
                {
                    if (memory.Length + read > maxBytes)
                    {
                        throw new InvalidOperationException(
                            "Stdin exceeds maximum size of " + maxBytes + " bytes.");
                    }
                    memory.Write(buffer, 0, read);
                }
                return Encoding.UTF8.GetString(memory.ToArray());
            }
        }

        internal static string BuildClipboardHtml(string fragment)
        {
            const string startFragment = "<!--StartFragment-->";
            const string endFragment = "<!--EndFragment-->";

            var body = "<html><body>" + startFragment + fragment + endFragment + "</body></html>";
            var headerTemplate =
                "Version:0.9\r\n" +
                "StartHTML:0000000000\r\n" +
                "EndHTML:0000000000\r\n" +
                "StartFragment:0000000000\r\n" +
                "EndFragment:0000000000\r\n";

            var startHtml = Encoding.UTF8.GetByteCount(headerTemplate);
            var startFragmentOffset = startHtml + Encoding.UTF8.GetByteCount("<html><body>" + startFragment);
            var endFragmentOffset = startHtml + Encoding.UTF8.GetByteCount("<html><body>" + startFragment + fragment);
            var endHtml = startHtml + Encoding.UTF8.GetByteCount(body);

            return headerTemplate
                .Replace("StartHTML:0000000000", "StartHTML:" + startHtml.ToString("D10"))
                .Replace("EndHTML:0000000000", "EndHTML:" + endHtml.ToString("D10"))
                .Replace("StartFragment:0000000000", "StartFragment:" + startFragmentOffset.ToString("D10"))
                .Replace("EndFragment:0000000000", "EndFragment:" + endFragmentOffset.ToString("D10"))
                + body;
        }

        // ---------------- Self-Test ----------------

        private static int RunSelfTest()
        {
            int failed = 0;

            // Test 1: Header-Länge ist konstant 105 Bytes (wichtig, weil viele
            // Berechnungen darauf aufbauen).
            const int headerBytes = 105; // Version + 4×Offset-Zeilen mit \r\n

            // Test 2: HTML-Clipboard-Format mit kurzem Fragment.
            failed += Assert("simple fragment", () =>
            {
                var html = BuildClipboardHtml("<p>Hello</p>");
                ValidateOffsets(html, headerBytes, fragmentText: "<p>Hello</p>");
            });

            // Test 3: leeres Fragment
            failed += Assert("empty fragment", () =>
            {
                var html = BuildClipboardHtml("");
                ValidateOffsets(html, headerBytes, fragmentText: "");
            });

            // Test 4: Mehrbyte-UTF-8 (Umlaute, Emoji)
            failed += Assert("utf8 fragment", () =>
            {
                var fragment = "<p>Grüße &amp; Tschüss €</p>";
                var html = BuildClipboardHtml(fragment);
                ValidateOffsets(html, headerBytes, fragmentText: fragment);
            });

            // Test 5: HTML-Header beginnt mit \"Version:0.9\"
            failed += Assert("starts with Version", () =>
            {
                var html = BuildClipboardHtml("<p>x</p>");
                if (!html.StartsWith("Version:0.9\r\n"))
                    throw new InvalidOperationException("Header does not start with Version:0.9");
            });

            if (failed == 0)
            {
                Console.WriteLine("Self-test passed.");
                return 0;
            }
            Console.Error.WriteLine("Self-test FAILED: " + failed + " case(s).");
            return 10;
        }

        private static int Assert(string name, Action body)
        {
            try
            {
                body();
                Console.WriteLine("  OK    " + name);
                return 0;
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("  FAIL  " + name + " — " + ex.Message);
                return 1;
            }
        }

        private static void ValidateOffsets(string clipHtml, int expectedStartHtml, string fragmentText)
        {
            // Offsets aus dem Header lesen
            int startHtml = ReadOffset(clipHtml, "StartHTML:");
            int endHtml = ReadOffset(clipHtml, "EndHTML:");
            int startFragment = ReadOffset(clipHtml, "StartFragment:");
            int endFragment = ReadOffset(clipHtml, "EndFragment:");

            if (startHtml != expectedStartHtml)
                throw new InvalidOperationException(
                    "StartHTML expected " + expectedStartHtml + " but was " + startHtml);

            var bytes = Encoding.UTF8.GetBytes(clipHtml);
            if (endHtml != bytes.Length)
                throw new InvalidOperationException(
                    "EndHTML " + endHtml + " != total bytes " + bytes.Length);

            // StartFragment muss direkt nach "<html><body><!--StartFragment-->" stehen
            const string opener = "<html><body><!--StartFragment-->";
            int expectedStart = startHtml + Encoding.UTF8.GetByteCount(opener);
            if (startFragment != expectedStart)
                throw new InvalidOperationException(
                    "StartFragment " + startFragment + " != expected " + expectedStart);

            int expectedEnd = expectedStart + Encoding.UTF8.GetByteCount(fragmentText);
            if (endFragment != expectedEnd)
                throw new InvalidOperationException(
                    "EndFragment " + endFragment + " != expected " + expectedEnd);

            // Substring zwischen StartFragment und EndFragment muss exakt dem fragmentText entsprechen
            var fragSlice = new ArraySegment<byte>(bytes, startFragment, endFragment - startFragment);
            var actualFragment = Encoding.UTF8.GetString(fragSlice.Array, fragSlice.Offset, fragSlice.Count);
            if (actualFragment != fragmentText)
                throw new InvalidOperationException(
                    "Fragment slice mismatch: '" + actualFragment + "' vs '" + fragmentText + "'");
        }

        private static int ReadOffset(string clipHtml, string label)
        {
            int idx = clipHtml.IndexOf(label, StringComparison.Ordinal);
            if (idx < 0) throw new InvalidOperationException("Label not found: " + label);
            var raw = clipHtml.Substring(idx + label.Length, 10);
            return int.Parse(raw);
        }
    }
}
