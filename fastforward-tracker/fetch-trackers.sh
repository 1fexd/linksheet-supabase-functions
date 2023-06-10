#!/bin/bash
wget https://raw.githubusercontent.com/FastForwardTeam/FastForward/master/src/js/rules.json -O rules.json
python3 build-tracker-ts.py
