# Refine desktop columns and scrollbars

## Changes
- Use a 70/30 desktop grid for the main content and bet slip.
- Reduce the space between the two columns to a compact gutter.
- Keep the bet slip stationary while the left column scrolls independently.
- Hide inner scrollbar styling until the user hovers over the scrollable area.
- Apply the same layout to Home, Sports, Live, and match-detail pages.

## Technical details
- Replace the reserved-margin/absolute-sidebar layout with explicit `7fr / 3fr` grid tracks on desktop.
- Add a reusable hover-only scrollbar utility and attach it to vertically scrollable content areas.
- Preserve the existing mobile full-screen bet slip behavior.

## Verification
- Check the Sports page at desktop width for the 70/30 proportion and reduced gutter.
- Confirm left and right areas scroll independently and scrollbar thumbs appear on hover.
