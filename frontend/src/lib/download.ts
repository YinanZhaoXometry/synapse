/**
 * The browser download seam (epic-31 T4): turn a text payload into a local
 * file without navigation. The Anki export (and any future text download)
 * rides this one helper — jsdom tests stub createObjectURL and observe the
 * anchor click.
 */
export function downloadTextFile(filename: string, text: string, mime = "text/tab-separated-values;charset=utf-8"): void {
  const blob = new Blob([ text ], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
