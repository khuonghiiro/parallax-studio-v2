# Running the Test

## Pre-Launch Checklist

- [ ] Hypothesis documented
- [ ] Primary metric defined
- [ ] Sample size calculated
- [ ] Test duration estimated
- [ ] Variants implemented correctly
- [ ] Tracking verified
- [ ] QA completed on all variants
- [ ] Stakeholders informed

## During the Test

**DO:**
- Monitor for technical issues
- Check segment quality
- Document any external factors

**DON'T:**
- Stop a fixed-horizon test on interim significance
- Make changes to variants
- Add traffic from new sources
- Override predeclared stopping boundaries because you "know" the answer

## Peeking Problem

In fixed-horizon testing, repeatedly checking for significance and stopping at the first positive result can cause:
- False positives
- Inflated effect sizes
- Wrong decisions

**Solutions:**
- Pre-commit to sample size and stick to it
- For sequential monitoring, choose a valid sequential method and its boundaries before launch; do not retrofit it after peeking.
- Stop for predeclared safety/harm conditions and report the interrupted result honestly.
- Trust the process

---
