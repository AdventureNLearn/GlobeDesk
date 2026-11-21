# Make your own GlobeDesk show

This starter kit is a clean baseline. It has no real places, people or claims, only placeholders marked `[UNKNOWN]` or `PLACEHOLDER`.

| File | What it is |
|---|---|
| `episode-template.globedesk.json` | A valid blank episode (`globedesk.episode/2`) with one placeholder story |
| `layer-template.geojson` | An Event Layer with one point, route, area and ring, all placed in the open ocean near 0°, 0° |
| `guide-pack-template/` | A blank narrator pack for the mission demo |

## 1. Run GlobeDesk

Get GlobeDesk from https://github.com/AdventureNLearn/GlobeDesk (or use the release zip), then run:

```bash
python3 tools/serve.py        # http://127.0.0.1:8080
```

On Windows, double-click `START-GLOBEDESK.bat`.

## 2. Open the template

Click **Open** and choose `episode-template.globedesk.json`. Then, in the **Look** tab, set your show name, handle, header badge, colors and the outro card.

## 3. Write a story

1. Give the story a headline and a short summary in the **Story** tab.
2. Drop a pin. You can click the globe, type coordinates, or search the bundled place list (it works offline).
   - Use an **approximate** pin, such as a city or a region.
   - **Never pin a private home**, or anything that could locate a private person.
3. Add a card in the **Cards** tab. Say what was reported, not more.
4. Add the source in the **Sources** tab as an https link, with a label.
   - If it's someone else's work, fill in **Creator credit** and **Credit link**.
   - Leave **As reported, not independently verified** on unless you checked the claim yourself.
   - If you don't know something, write `[UNKNOWN]` rather than guessing.
5. Write captions in the **Captions** tab, or import an SRT or VTT file.

Click **+ story** for the next one.

## 4. Add media and sound

Drop video, images or audio into the **Media bin**. They stay in your browser and are never uploaded. Then:

- Use the **Place** tab to show a file as a card, a pin popup, a screen overlay or a geo-anchored panel.
- Use the **Sound** tab for overlays (volume, offset, loop), or the **Shots** tab for a voiceover.

Only use media you have the rights to.

## 5. Add an Event Layer

In the **Events** tab, import `layer-template.geojson`. Move or replace the placeholder shapes, and set each one's date, category, verification label and source. You can export to GeoJSON, CSV or KML.

## 6. Save, record, share

| Button | What it saves |
|---|---|
| **Save project** | A `.globedesk` file (JSON plus media) |
| **Save JSON** | The episode only |
| **Record WebM** | A local 16:9 or 9:16 video |

## 7. Make a narrator (optional)

Follow `guide-pack-template/README.md` to give the mission demo your own guide.

## 8. Use an assistant (optional)

The **Assist** tab gives you a prompt and the schema. Paste it into any assistant and paste the JSON back. GlobeDesk validates it before loading, and it never sends anything to a model itself.

## Rules worth keeping

- Credit and link every creator whose work you use.
- Don't invent facts. Mark gaps `[UNKNOWN]`.
- Keep pins approximate, and keep private people private.
- Never put API keys or passwords in an episode file.

## License

GlobeDesk code is MIT. This starter kit's text and templates are AdventureNLearn content under CC BY 4.0 (see `LICENSE` and `LICENSE-CONTENT`). What you create with it is yours.
