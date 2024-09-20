#!/bin/bash -e
bun json-to-moonbit.test.js
moon test --target wasm
