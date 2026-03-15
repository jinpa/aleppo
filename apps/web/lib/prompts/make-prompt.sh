OUT=~/Desktop/prompt.txt

(
    cat prefix.txt
    for f in $(ls *.json); do
        echo "---" 
        echo "EXAMPLE:"
        cat $f
    done
    echo "---"
    echo "RULES:"
    echo "0- Keep the recipe in its original language"
    cat instructions.txt
    echo "---"
    echo "Extract the recipe from the provided images"
    echo "JSON:"
) > $OUT

cat $OUT | pbcopy
