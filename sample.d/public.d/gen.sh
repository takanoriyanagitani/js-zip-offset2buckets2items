#!/bin/sh

izname="./sample.d/input.zip"
ixname="./sample.d/offsets.least.asn1.der.dat"

genjson(){
  order=$1
  user=$2
  now=$3

  jq \
    -c \
    -n \
    --arg order $order \
    --arg user $user \
    --arg now $now \
    '{
      order: $order | tonumber,
      user: $user | tonumber,
      timestamp: $now | tonumber,
      items: [
        {item: 42, quantity: 2, price: 42.195},
        {item: 43, quantity: 3, price:  3.776}
      ]
    }'
}

jsonl(){
  user=$1
  ostart=$2
  oend=$3

  echo creating order data for ${user}...

  seq $ostart $oend |
    while read order; do
      now=$( date +%s%N )
      ms=$(( now / 1000 / 1000 ))
      genjson $order $user $ms
    done |
    gzip --fast |
    cat > ./sample.d/$user.jsonl.gz
}

geninput(){
  echo creating sample files...

  mkdir -p ./sample.d

  seq 1 256 |
    while read user; do
      jsonl $user 1000 1031
    done

  find \
    ./sample.d \
    -type f \
    -name '*.jsonl.gz' |
    zip \
      -0 \
      -@ \
      -T \
      -v \
      -o \
      "${izname}"
}

genindex(){
  echo creating the index file...

  which wazero | fgrep -q wazero || exec sh -c '
    echo wazero missing.
    exit 1
  '

  which zip2ix2asn1 | fgrep -q zip2ix2asn1 || exec sh -c '
    echo zip2ix2asn1 missing.
    echo it can be installed using go install.
    echo url: https://github.com/takanoriyanagitani/go-zip2ix
    echo tinygo can be used instead to create a wasi bytecode.
    exit 1
  '

  ENV_INPUT_ZIP_FILENAME="${izname}" \
    zip2ix2asn1 |
    dd \
      if=/dev/stdin \
      of="${ixname}" \
      bs=1048576 \
      status=none
}

test -f "${izname}" || geninput
test -f "${ixname}" || genindex
