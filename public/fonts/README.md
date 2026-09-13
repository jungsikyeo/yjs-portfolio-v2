Pretendard subsets used for the in-browser résumé PDF (lib/resume-pdf.ts).
Regenerate from the Pretendard release (public/static/alternative/*.ttf) with fontTools:
  pyftsubset Pretendard-{Regular,SemiBold,Bold}.ttf --output-file=Pretendard-Regular-subset.ttf --unicodes-file=unicodes.txt --layout-features='' --no-hinting
unicodes.txt = KS X 1001 Hangul (2,350 syllables, i.e. those EUC-KR encodes in 2 bytes) + U+0020-007E, U+00A0-00FF, U+2010-2027, U+2030-205E, U+20A9, U+2190-21FF, U+2460-24FF, U+25A0-25FF, U+2600-26FF, U+3000-303F, U+3131-318E, U+FF01-FF5E.
Layout features are stripped on purpose: pdf-lib ignores GPOS/GSUB when computing advances, so keeping them produced gaps after ':' and '-'. Fonts are embedded whole (subset:false) because fontkit's TrueType subsetter drops glyphs from this face.
License: SIL OFL 1.1, see LICENSE-Pretendard.txt.
