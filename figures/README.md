# Figures

Diagrams for the report. Every label follows [docs/BusinessRules.md](../docs/BusinessRules.md); if a rule changes, change the source here and re-render.

| Figure | Source | Shows |
|---|---|---|
| `seller_userflow.png` | `src/seller_userflow.mmd` | Free listing, optional premium placement (฿49 / 7 days), sale paid in person or with protection, 48-hour window from handover, dispute outcome |
| `buyer_userflow.png` | `src/buyer_userflow.mmd` | Pay in person (free, no escrow) or with protection (price + ฿10 + 3%), 48-hour window from handover, auto-release, dispute |
| `owner_userflow.png` | `src/owner_userflow.mmd` | Suggested deposit (฿200–3,000), request → approve → pay, full rental fee 48 h after handover, return photos, late fee / missing, dispute outcomes |
| `renter_userflow.png` | `src/renter_userflow.mmd` | Rental fee + 10% + escrow fee `max(฿30, 3%)` + deposit, late fee / missing, 48-hour window from return, dispute outcomes |
| `usecase_diagram.svg` / `.png` | `usecase_diagram.svg` (hand-written SVG) | What each kind of user can do; payments are simulated in-app (no gateway) |

The four Mermaid sources are also copied into [docs/Mapping&UF.md](../docs/Mapping&UF.md). Keep the two the same.

## Re-render the user flows

Uses [mermaid-cli](https://github.com/mermaid-js/mermaid-cli) with the shared style in `src/mermaid-config.json`. Run from this folder:

```sh
npx -y @mermaid-js/mermaid-cli@11.4.2 -i src/renter_userflow.mmd -o renter_userflow.png -c src/mermaid-config.json -b white -s 2
```

Repeat for `buyer`, `seller` and `owner`. If puppeteer can't download Chrome, point it at an installed browser with a puppeteer config file and add `-p puppeteer.json`:

```json
{ "executablePath": "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" }
```

(set `PUPPETEER_SKIP_DOWNLOAD=true` so `npx` doesn't try to fetch Chrome first).

## Re-render the use case diagram

Edit `usecase_diagram.svg` directly, then screenshot it at 2× with headless Edge or Chrome (the SVG is 1720 × 990):

```sh
msedge --headless=new --hide-scrollbars --force-device-scale-factor=2 --window-size=1720,990 --screenshot="<full path>\usecase_diagram.png" "file:///<full path>/usecase_diagram.svg"
```
