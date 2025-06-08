/** @import { IO } from "./io.mjs" */

/** @type function(Blob): IO<string> */
export function blob2zcat2text(blob) {
  return () => {
    /** @type DecompressionStream */
    const zcat = new DecompressionStream("gzip");

    const decoded = blob.stream().pipeThrough(zcat);
    /** @type Response */
    const res = new Response(decoded);

    return res.text();
  };
}
