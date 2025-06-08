import { bind } from "./io.mjs";

import { blob2zcat2text } from "./zcat.mjs";

/** @import { IO } from "./io.mjs" */

/** @type function(string): IO<Response> */
export function url2response(url) {
  return () => fetch(url);
}

/** @type function(Response): IO<ArrayBuffer> */
export function response2buffer(res) {
  return () => res.arrayBuffer();
}

/** @type function(string): IO<ArrayBuffer> */
export function url2buffer(url) {
  /** @type IO<Response> */
  const ires = url2response(url);

  return bind(ires, response2buffer);
}

/** @type function(Response): IO<Blob> */
export function response2blob(res) {
  return () => {
    return res.blob();
  };
}

/** @type function(Response): IO<string> */
export function response2blob2zcat2text(res) {
  /** @type IO<Blob> */
  const iblob = response2blob(res);

  return bind(iblob, blob2zcat2text);
}
