#!/bin/bash
# Simple script to run the jumping jack counter with the correct Python environment

# Activate virtual environment
source venv/bin/activate

# Change to the Fitness directory
cd Fitness

# Run the program
python jumping_jack_counter.py

# Deactivate when done
deactivate


