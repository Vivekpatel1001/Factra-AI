# Factra AI Demo Inputs

Use these inputs for a controlled demo. They are designed to show TRUE, FALSE, MISLEADING, UNVERIFIED, OCR, and video workflows.

## Text Inputs

### TRUE

```text
India won the 2024 ICC Men's T20 World Cup after defeating South Africa in the final.
```

Expected result: TRUE

Why it works: This is a stable sports fact with strong public evidence.

### FALSE

```text
The Government of India is giving free laptops to all students through a registration link under the National Student Laptop Scheme 2026.
```

Expected result: FALSE

Why it works: This type of claim has been publicly debunked by PIB Fact Check and news reports.

### MISLEADING

```text
All Indian students are eligible for free laptops from the government.
```

Expected result: MISLEADING or FALSE

Why it works: Some state or category-based schemes exist, but the broad "all students" claim is not correct.

### UNVERIFIED

```text
A private college in Ahmedabad will cancel all engineering admissions tomorrow due to an ACPC scam.
```

Expected result: UNVERIFIED

Why it works: It is specific, urgent, and likely lacks strong public evidence unless a reliable source has reported it.

## Link Inputs

### TRUE Link

```text
https://www.icc-cricket.com/tournaments/t20cricketworldcup/videos/india-script-stunning-title-win-match-highlights-sa-v-ind-t20wc-2024-final
```

Expected result: TRUE context about India winning the 2024 T20 World Cup.

### FALSE / Scam Link Context

```text
https://www.facebook.com/pibfactcheck/posts/a-text-message-with-a-website-link-is-circulating-with-a-claim-that-the-governme/530835901782841/
```

Expected result: FALSE or scam/fake context about a free laptop claim.

### Link That Should Not Invent Claims

```text
https://www.youtube.com/shorts/example
```

Expected result: UNVERIFIED / no checkable claim extracted.

Why it works: The app should not search random platform text like "What is YouTube Shorts".

## Image / OCR Inputs

Create a simple image in Canva, PowerPoint, or Paint with the text below. Upload it under the Image tab.

### Fake OCR Poster

```text
BREAKING NEWS
Government of India is giving free laptops to all students.
Register today on the link before midnight.
```

Expected result: FALSE or MISLEADING

### Real OCR Poster

```text
India won the 2024 ICC Men's T20 World Cup.
India defeated South Africa in the final at Bridgetown.
```

Expected result: TRUE

### Low Confidence OCR Test

Use a blurry screenshot or very small text:

```text
Govt free laptop urgent claim register now
```

Expected behavior: App should ask to correct OCR text if confidence is low.

## Video Inputs

Record a 10-15 second phone video or screen recording reading one of these scripts aloud. Keep it short for the fastest demo.

### TRUE Video Script

```text
India won the 2024 ICC Men's T20 World Cup by defeating South Africa in the final.
```

Expected result: TRUE

### FALSE Video Script

```text
The Government of India is giving free laptops to every student through a new registration link. Everyone should apply today.
```

Expected result: FALSE

### MISLEADING Video Script

```text
The government gives free laptops to all students in India.
```

Expected result: MISLEADING or FALSE

### UNVERIFIED Video Script

```text
My local college will cancel all engineering admissions tomorrow because of an ACPC scam.
```

Expected result: UNVERIFIED

### AI-Generated News Style Video Script

```text
Breaking update: a viral AI-generated video claims that NASA admitted all moon mission footage was fake. There is no official NASA statement confirming this.
```

Expected result: UNVERIFIED or MISLEADING

## Demo Tips

- For fastest video demo, keep clips under 15 seconds.
- Use one clear claim per video.
- Avoid background music during speech-to-text demos.
- For image OCR demos, use large high-contrast text.
- For link demos, paste articles or fact-check pages, not generic Shorts/Reels links.

## Source Notes

- ICC official pages confirm India defeated South Africa in the 2024 ICC Men's T20 World Cup final.
- PIB Fact Check and multiple news reports have debunked free-laptop-for-all-students messages.
- Use these examples as demo-safe claims, not as a complete misinformation dataset.
