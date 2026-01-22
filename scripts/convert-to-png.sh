#!/bin/bash
# Convert SVG files to PNG using macOS sips and qlmanage
# This script converts all SVGs in the generated folder to PNGs

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GENERATED_DIR="$SCRIPT_DIR/../social-media-assets/generated"

echo "Converting SVGs to PNGs..."
echo ""

# Function to convert SVG to PNG using a node script (more reliable for complex SVGs)
convert_svg() {
    local svg_file="$1"
    local png_file="${svg_file%.svg}.png"

    # Use qlmanage (Quick Look) for conversion - works well on macOS
    qlmanage -t -s 1080 -o "$(dirname "$png_file")" "$svg_file" 2>/dev/null

    # Rename the output file (qlmanage adds .png to full filename)
    local ql_output="${svg_file}.png"
    if [ -f "$ql_output" ]; then
        mv "$ql_output" "$png_file"
        echo "  Converted: $(basename "$png_file")"
        return 0
    fi

    return 1
}

# Find all SVG files and convert
find "$GENERATED_DIR" -name "*.svg" -type f | while read svg_file; do
    convert_svg "$svg_file"
done

echo ""
echo "Conversion complete!"
echo ""
echo "Note: If conversions failed, you can use these alternatives:"
echo "  1. Open SVGs in browser and screenshot"
echo "  2. Use Figma: Import SVG -> Export as PNG"
echo "  3. Use online converter: svgtopng.com"
echo "  4. Install ImageMagick: brew install imagemagick"
