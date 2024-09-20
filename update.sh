#!/bin/bash -ex
moon update && moon install && rm -rf target
# moon fmt
./test-all.sh
