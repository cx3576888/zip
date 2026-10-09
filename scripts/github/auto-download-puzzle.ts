import { chromium, type Page } from "@playwright/test";
import fs from "fs";

const TARGET_URL = "https://www.linkedin.com/games/view/zip/desktop/";
const SELECTOR = {
  PUZZLE_ID_TEXT: ".launch-footer__score-text",
  START_BUTTON: "#launch-footer-start-button",
  GAME_BOARD: ".grid-game-board",
  CELL_WRAPPER: ".trail-cell",
  CELL_CONTENT: ".trail-cell-content",
  CELL_WALL_U: ".trail-cell-wall--up",
  CELL_WALL_R: ".trail-cell-wall--right",
  CELL_WALL_D: ".trail-cell-wall--down",
  CELL_WALL_L: ".trail-cell-wall--left",
};

enum Wall {
  Up = "UP",
  Right = "RIGHT",
  Down = "DOWN",
  Left = "LEFT",
}

type PuzzleCellType = {
  row: number; // starts at 1
  col: number; // starts at 1
  cellContent: string | null;
  walls: Wall[];
};

type PuzzleJson = {
  zip: PuzzleCellType[][];
};

async function getPuzzleId(page: Page) {
  const text = await page.locator(SELECTOR.PUZZLE_ID_TEXT).innerText();
  // "編號：571", "No.571"
  const match = text.match(/\d+/);
  if (match === null) {
    throw new Error(`- Get puzzleId failed! from ${text}`);
  }
  return match[0];
}

async function getPuzzleJson(page: Page) {
  const gameBoardLocator = page.locator(SELECTOR.GAME_BOARD);
  await gameBoardLocator.waitFor({ state: "visible" });
  const zipCells = await gameBoardLocator.locator(SELECTOR.CELL_WRAPPER).all();
  const res: PuzzleJson = { zip: [] };

  const n = Math.sqrt(zipCells.length); // a zip puzzle must be a square
  for (let rowIdx = 0; rowIdx < n; rowIdx++) {
    res.zip.push([]);
    for (let colIdx = 0; colIdx < n; colIdx++) {
      const zipCell = zipCells[rowIdx * n + colIdx]!;
      const cellContentLocator = zipCell.locator(SELECTOR.CELL_CONTENT);

      res.zip[rowIdx]!.push({
        row: rowIdx + 1,
        col: colIdx + 1,
        cellContent: (await cellContentLocator.isVisible())
          ? await cellContentLocator.innerText()
          : null,
        walls: [
          ...((await zipCell.locator(SELECTOR.CELL_WALL_U).isVisible())
            ? [Wall.Up]
            : []),
          ...((await zipCell.locator(SELECTOR.CELL_WALL_R).isVisible())
            ? [Wall.Right]
            : []),
          ...((await zipCell.locator(SELECTOR.CELL_WALL_D).isVisible())
            ? [Wall.Down]
            : []),
          ...((await zipCell.locator(SELECTOR.CELL_WALL_L).isVisible())
            ? [Wall.Left]
            : []),
        ],
      });
    }
  }
  return res;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(TARGET_URL);
    const puzzleId = await getPuzzleId(page);

    await page.locator(SELECTOR.START_BUTTON).click();
    const puzzleJson = await getPuzzleJson(page);

    fs.writeFileSync(
      `./public/puzzles/zip${puzzleId}.json`,
      JSON.stringify(puzzleJson),
    );
    console.log(`- Download zip${puzzleId}.json success: `, new Date());
  } finally {
    await browser.close();
  }
}
main().catch((err) => {
  console.log("- Download error:", err);
  process.exitCode = 1;
});
