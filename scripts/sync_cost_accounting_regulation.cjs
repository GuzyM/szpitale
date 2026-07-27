#!/usr/bin/env node

const { writeFile } = require("node:fs/promises");
const { resolve } = require("node:path");
const { JSDOM } = require("jsdom");

const SOURCE_URL = "https://eli.gov.pl/api/acts/DU/2020/2045/text.html";
const OUTPUT_PATH = resolve(__dirname, "../data/cost-accounting-regulation.js");

function cleanText(element) {
  const clone = element.cloneNode(true);
  clone.querySelectorAll("script, style, noscript, .tooltip-text").forEach((item) => item.remove());
  clone.querySelectorAll("br, p, div, li, tr, td, th, h1, h2, h3, h4").forEach((item) => {
    item.append("\n");
  });
  return clone.textContent
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

async function main() {
  const response = await fetch(SOURCE_URL);
  if (!response.ok) {
    throw new Error(`Nie udało się pobrać rozporządzenia (${response.status}).`);
  }

  const html = await response.text();
  const document = new JSDOM(html).window.document;
  const sections = [];

  for (let number = 1; number <= 10; number += 1) {
    const element = document.querySelector(`#part_1 #para_${number}`);
    if (!element) throw new Error(`Brak § ${number} w źródle ELI.`);
    sections.push({
      id: `paragraph-${number}`,
      reference: `§ ${number}`,
      title: `Treść § ${number}`,
      text: cleanText(element)
    });
  }

  for (let number = 1; number <= 9; number += 1) {
    const element = document.querySelector(`#part_${number + 1}`);
    if (!element) throw new Error(`Brak załącznika nr ${number} w źródle ELI.`);
    const heading = cleanText(element.querySelector("h2.part"));
    sections.push({
      id: `annex-${number}`,
      reference: `Załącznik nr ${number}`,
      title: heading,
      text: cleanText(element)
    });
  }

  const payload = {
    meta: {
      sourceUrl: SOURCE_URL,
      act: "Dz.U. 2020 poz. 2045",
      generatedAt: new Date().toISOString(),
      sectionCount: sections.length
    },
    sections
  };
  const content = `"use strict";\n\nwindow.HOSPITALAPP_SRK_FULLTEXT = ${JSON.stringify(payload, null, 2)};\n`;
  await writeFile(OUTPUT_PATH, content, "utf8");
  console.log(`Zapisano ${sections.length} części pełnego tekstu w ${OUTPUT_PATH}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
