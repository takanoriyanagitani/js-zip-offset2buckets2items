import { bind, lift } from "./io.mjs";

import { response2blob2zcat2text } from "./req.mjs";

import {
  sequence2values,
  url2sequence,
  values2offsets,
  zip2offsets2buckets,
} from "./index-min.mjs";

(() => {
  /** @type string */
  const zurl = "/sample.d/input.zip";

  /** @type string */
  const ourl = "/sample.d/offsets.least.asn1.der.dat";

  /** @type IO<asn1.Sequence?> */
  const ioseq = url2sequence(ourl);

  /** @type IO<asn1.Sequence?> */
  const iseq = bind(
    ioseq,
    lift((oseq) => {
      if (!oseq) return Promise.reject(new Error("null sequence"));
      return Promise.resolve(oseq);
    }),
  );

  /** @type IO<Array<asn1.Sequence>> */
  const iaseq = bind(
    iseq,
    lift((seq) => sequence2values(seq)),
  );

  /** @type IO<Array<LeastZipIndexInfo>> */
  const iaoffset = bind(
    iaseq,
    lift((aseq) => values2offsets(aseq)),
  );

  /**
   * @typedef {object} Bucket
   */

  /** @type IO<Array<Bucket>> */
  const ibuckets = bind(
    iaoffset,
    (offsets) =>
      zip2offsets2buckets(
        zurl,
        offsets,
        (response) => {
          /** @type IO<string> */
          const ijsonl = response2blob2zcat2text(response);

          /** @type IO<string[]> */
          const ilines = bind(
            ijsonl,
            lift((jsonl) => jsonl.split(/\n/)),
          );

          /** @type IO<object[]> */
          const iobjs = bind(
            ilines,
            lift(
              (lines) =>
                lines
                  .filter((line) => !!line)
                  .map((line) => JSON.parse(line)),
            ),
          );

          return iobjs;
        },
        240,
      ),
  );

  const div = document.getElementById("app-root");

  /** @type function(Array<Bucket>): IO<Void> */
  const printBucketsInfo = (buckets) => () => {
    return Promise.resolve()
      .then((_) => {
        const frag = new DocumentFragment();

        let bix = 0;
        for (const b of buckets) {
          const blen = b.length;
          const text = `bucket ${bix} length: ${blen}`;

          const cdiv = document.createElement("div");
          cdiv.textContent = text;

          frag.appendChild(cdiv);

          bix += 1;
        }

        div.textContent = "";

        div.appendChild(frag);
      });
  };

  /** @type IO<Void> */
  const sub = bind(ibuckets, printBucketsInfo);

  return sub().catch(console.error);
})();
