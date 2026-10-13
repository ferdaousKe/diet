"""Turn dist/index.html (single-file Vite build) into an artifact page body:
<title>, font links and styles first, then the root element and the inlined module script."""
import re
import sys
import pathlib

src = pathlib.Path(sys.argv[1]).read_text()
out = pathlib.Path(sys.argv[2])

title = re.search(r"<title>.*?</title>", src, re.S).group(0)
links = "\n".join(re.findall(r"<link[^>]+>", src))
styles = "\n".join(re.findall(r"<style[^>]*>.*?</style>", src, re.S))
scripts = re.findall(r"<script[^>]*type=\"module\"[^>]*>.*?</script>", src, re.S)
assert len(scripts) == 1, f"expected one module script, found {len(scripts)}"
script = re.sub(r"\s+crossorigin", "", scripts[0], count=1)

out.write_text(f"{title}\n{links}\n{styles}\n<div id=\"root\"></div>\n{script}\n")
print(f"wrote {out} ({out.stat().st_size / 1024:.0f} KB)")
