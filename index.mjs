import * as asn1 from "asn1js";

import { bind, lift } from "./io.mjs";

import { url2buffer } from "./req.mjs";

/** @import { IO } from "./io.mjs" */

/**
 * @typedef {object} LeastZipIndexInfo
 * @property {string} name
 * @property {number} offset
 * @property {number} compressedSize
 */

/**
 * @param {string} url
 * @returns {function(LeastZipIndexInfo): IO<Response>}
 */
export function offset2response(url) {
  return (ixinfo) => {
    return () => {
      /** @type Headers */
      const headers = new Headers();

      /** @type number */
      const offset = ixinfo.offset;

      /** @type number */
      const size = ixinfo.compressedSize;

      /** @type number */
      const start = offset;

      /** @type number */
      const end = start + size - 1;

      headers.append(
        "Range",
        `bytes=${start}-${end}`,
      );

      return fetch(url, { headers })
        .then((res) => {
          if (!res.ok) return Promise.reject(new Error("non-ok response"));
          if (206 != res.status) {
            return Promise.reject(
              new Error(
                `unexpected status: ${res.status}`,
              ),
            );
          }

          return res;
        });
    };
  };
}

/**
 * @template B
 * @param {string} zurl
 * @param {Array<LeastZipIndexInfo>} offsets
 * @param {function(Response): IO<B>} response2bucket
 * @param {number} maxNumberOfBuckets
 * @returns {IO<B[]>}
 */
export function zip2offsets2buckets(
  zurl,
  offsets,
  response2bucket,
  maxNumberOfBuckets = 256,
) {
  return () => {
    /** @type function(LeastZipIndexInfo): IO<Response> */
    const offset2res = offset2response(zurl);

    /** @type Array<LeastZipIndexInfo> */
    const taken = offsets.slice(0, maxNumberOfBuckets);

    /** @type IO<Response>[] */
    const iares = taken.map(offset2res);

    /** @type IO<B>[] */
    const ibuckets = iares.map((ires) => bind(ires, response2bucket));

    /** @type Promise<B>[] */
    const pbuckets = ibuckets.map((i) => i());

    return Promise.all(pbuckets);
  };
}

/** @type function(ArrayBuffer): asn1.Sequence? */
export function buffer2sequence(buf) {
  /** @type asn1.FromBerResult */
  const parsed = asn1.fromBER(buf);

  if (-1 === parsed.offset) return null;

  /** @type boolean */
  const isSequence = parsed.result instanceof asn1.Sequence;

  // @ts-ignore
  return isSequence ? parsed.result : null;
}

/** @type function(asn1.Sequence): LeastZipIndexInfo? */
export function sequence2offsetInfo(seq) {
  const values = seq.valueBlock.value;

  /** @type number */
  const sz = values.length;

  if (4 !== sz) return null;

  const aname = values[0];
  const aofst = values[1];
  const asize = values[2];

  const ncheck = aname instanceof asn1.Utf8String;
  const ocheck = aofst instanceof asn1.Integer;
  const scheck = asize instanceof asn1.Integer;

  const ok = ncheck && ocheck && scheck;

  if (!ok) return null;

  /** @type string */
  const name = aname.getValue();

  /** @type BigInt */
  const bofst = aofst.toBigInt();

  /** @type BigInt */
  const bsize = asize.toBigInt();

  return Object.freeze({
    name,
    offset: Number(bofst),
    compressedSize: Number(bsize),
  });
}

/** @type function(string): IO<asn1.Sequence?> */
export function url2sequence(url) {
  /** @type IO<ArrayBuffer> */
  const ibuf = url2buffer(url);

  return bind(ibuf, lift((buf) => Promise.resolve(buffer2sequence(buf))));
}

/** @type function(asn1.Sequence): Array<asn1.Sequence> */
export function sequence2values(seq) {
  const values = seq.valueBlock.value;
  return values.filter((val) => val instanceof asn1.Sequence);
}

/** @type function(Array<asn1.Sequence>): Array<LeastZipIndexInfo> */
export function values2offsets(values) {
  return values.flatMap((val) => {
    /** @type LeastZipIndexInfo? */
    const oindex = sequence2offsetInfo(val);

    if (!oindex) return [];

    /** @type LeastZipIndexInfo */
    const ix = oindex;

    return [ix];
  });
}
