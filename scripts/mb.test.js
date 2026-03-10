#!/usr/bin/env bun
// tests for mb.js challenge solver
// run: bun scripts/mb.test.js

import { solveChallenge } from "./mb.js"

let passed = 0, failed = 0

function check(label, input, expected) {
  let result
  try { result = solveChallenge(input) } catch (e) { result = `ERROR: ${e.message}` }
  if (result === expected) {
    console.log(`  ✓ ${label}`)
    passed++
  } else {
    console.log(`  ✗ ${label}`)
    console.log(`    input:    ${input}`)
    console.log(`    expected: ${expected}`)
    console.log(`    got:      ${result}`)
    failed++
  }
}

console.log("— challenge solver tests —\n")

// basic arithmetic
check("simple addition", "3 + 5, what is total?", "8.00")
check("word addition", "twenty eight plus seven, what is the sum?", "35.00")
check("subtraction", "fifty minus twelve, what is the difference?", "38.00")

// explicit operator takes priority over keyword extraction
check(
  "explicit + operator beats 'total' keyword",
  "twenty eight newtons + gains seven newtons, what is total force?",
  "35.00"
)

// the failing case: "physics-y" contains "six" in letter soup
// old code: extractAllNumbers found 6 (from "phyysixsy") + 28 + 7 = 41 (WRONG)
// new code: token-aware matching requires full consumption, so "physics-y" → null
check(
  "physics-y does not extract six (regression: was 41.00)",
  "A] lOoOoB sT-ErR sW^iMmS liKe Um, pHyYsIxS-y Um, lo.b sT ErR, sO mAnY neUrOnS aNd ClAwS ]tHaT pUsH, ThIs ClAw F[oRcE] iS TwEnTy] EiG-hT nEuToNs + GaInS SeVeN nEuToNs DuRiNg MoLtInG, WhAt Is ToTaL- FoRcE?",
  "35.00"
)

// obfuscated numbers
check("obfuscated twenty-eight via hyphen", "ThIs FoRcE Is TwEnTy] EiG-hT + SeVeN, WhAt Is ToTaL?", "35.00")
check("duplicate letters", "TTWWENTY plus EEIGHT, what is the sum?", "28.00")

// compound number phrases
check("thirty five as two tokens", "thirty five newtons, plus twelve, what is total?", "47.00")

// inter-token obfuscation: number word split across whitespace
check("thir ty + seven", "ThIr Ty NoOoTtOnS + SeVeN, what is total force?", "37.00")
check("fif teen + eight", "FiF tEeN NoOoTtOnS + EiGhHt, what is total?", "23.00")
check(
  "inter-token split: thir ty + fif teen",
  "A] LoO bS tEr Pu^ShEs WiTh ThIr Ty NoOoTtOnS ~AnD GaAi Ns FiF tEeN NoOoTtOnS {um} WhAt Is ToTaL FoRcE?",
  "45.00"
)

// real challenge texts from session logs (2026-03-10)
check(
  "net force: claw force minus water resistance",
  "Lo.bStEr] S^wImS Um| AnD ExErTs ClAw] FoRcE Of TwEnTy FoUr~ NeWToNs, BuT WaTeR ReSiStAnCe Is SiX] NeWToNs - WhAt Is NeT FoRcE?",
  "18.00"
)
check(
  "slows by: new speed after deceleration",
  "A] Lo.BsT.eR S^wImS[ aT tWeNtY tWo/ cEnT iMeTeRs PeR sE/cOnD ~ AnD SlO^wS ]bY SeV eN {,} WhAt Is ThE NeW SpEeD?",
  "15.00"
)
check(
  "total force: two claws same direction (23+15)",
  "A] Lo.BbSsT-tEr S^wI mMs UmM, ClAw ExErTs TwEnTy ThReE NeW^tOnS, AnOtHeR ClAw ExErTs FiFtEeN NeW|tOnS, WhAtS ToTaL FoRcE?",
  "38.00"
)
check(
  "total force: how much total (32+20)",
  "A] LoB-StEr^ ClAw FoR|Ce Is ThIrTy TwO NeWtOnS ~ AnD AnOtHeR] ClAw FoR^Ce Is TwEnTy NeWtOnS, HoW MuCh ToTaL FoRcE?",
  "52.00"
)
check(
  "new speed: adds seven (23+7)",
  "A] LoO b-StErS S^wImS [aT tW/eN tY ThReE mE^tErS PeR SeCoNd ~AnD AnTeNnA ToUcH AdDs SeVeN, WhAt Is ThE NeW SpEeD?",
  "30.00"
)
check(
  "total force: two claws heavy obfuscation (35+7)",
  "A] lOoObSsT-tEr S^cLaWw ExErRtSs thIr RtYy fIiV-e NoOoToOnNs~ AnD| aNnOtThHeEr ClLaAwW ExErRtSs SeVeEnN NoOoToOnNs, WhHaT Is ToTaLl FoOrRcEe<? um",
  "42.00"
)
check(
  "total force: one claw plus another adds (34+6)",
  "A] LoOobBsTtEr ] ClLaAwW^ FoOrRcEe- OfF ] ThHiIrRtTyY { FoOuUrR ] NeEwWtToOnNs ~ aNdD ] ThHeE ] OtThHeErR ] ClLaAwW / AdDdSs ] SiIxX ] NeEwWtToOnNs, ] WhHaAtT ] IiSs ] ToOtTaAlL } FoOrRcEe < ?",
  "40.00"
)

check(
  "total force: one claw + another, structural 'one' not counted (23+14)",
  "A] LoOooBSt-Er Lo.bSt ErRr ExErTs^ TwEnTy ThReE NooToNs| WiTh- OnE ClAw~ , Um AnOtHeR ExErTs { FoUrTeEn Nootons } , WhAt/ Is< ThE ToTaL FoRcE?",
  "37.00"
)

check(
  "loses: new velocity after losing speed (23-7)",
  "A] lOoObBsT-eR^ sW/iMmS~ iN {cOoLm} wAtEr| wiTh^ a^ veLoOwCiTyyy] tWeNtY tHrEe< mEtErS} pEr~ sEcOnD- buT/ dUrInG^ mOlT|iNg- iT- loSsEs] sEvEn~ mEtErS pEr/ sEcOnD, uHm, wHaT^ iS- tHe< nEw} veLoOwCiTy?",
  "16.00"
)

check(
  "total force: exerts twenty five + another adds thirty (25+30)",
  "A] lOoObBsStTeErR Ex^eRrTtSs TwWeEnNtTyY FfIiVvEe NnOoOoTtOoNnSs, Um| WiTh] OnNeE CcLlAaWw WhHiIlLeE ThHeE OoTtHhEeRr AaDdDsS ThHiIrRtTyY NnEeWwTtOoNnSs - WwHhAaTt IiSs] ThHeE TtOoTtAaLl FfOoRrCcEe?",
  "55.00"
)

check(
  "strikes twice: 35 × 2 = 70",
  "ThE] lOo.oBbSsSttEeRr] ClA-w^ F.oR cE] Is ThIrTy FiVe~ NeUwToOnS] AnD/ iT StRrIiKeSs TwIcE, WhAt] Is ToTaL FoRcE?",
  "70.00"
)

check(
  "y-for-i substitution: 'FyV e' → twenty-five (25+15)",
  "A] lOoOoB-sT]eR ClAw] ExErT s TwEnTy FyV e NooToNs~, Um AnOtHeR] ClAw ExErT s FiFtEeN NooToNs/ - HoW MuCh ToTaL FoR^cE?",
  "40.00"
)

check(
  "torque: force × lever arm (17N × 3m = 51)",
  "Lo.ObS tEr] ClAw^ ApPlIeS {SeVeNtEeN} NeWtOnS- At/ LeVeR\\ ArM~ Of< ThReE> MeTeRs, WhAtS ToRqUe?",
  "51.00"
)

check(
  "product: 'multiply the two forces and velocity' — skip structural 'two', use unit-anchored (23 × 7 = 161)",
  "A] LoObBsT-eR S^wImS lOoOoB sPeEd LiKe Um, tW/eN]tY ThReE cEnTImE-tErS PeR S^eCoNd, AnD iTs ClAw FOrCe Is LiKe, sSso, sEvEn N{eWtOnS; MuLtIpLy ThE/tWo FoRcEs AnD/ vElAwCiTy To GeT tHe PrOdUcT?",
  "161.00"
)
check(
  "multiply keyword alone (no 'product'): claw force × tail speed (23 × 4 = 92)",
  "A] LoO.oBbSsTtEr~ ClAw^ ExErTs\\ TwEnTy ThR^eE NoOtOnS| AnD{ TaIl~ SlApS/ WiTh Fo]uR MeTeRs PeR SeCoNd~ MuLtIpLy?",
  "92.00"
)

check(
  "gains three times: 25 × 3 = 75",
  "A] lO^bSt-Er lo.oobsssT Errr'S cLaW] eXxErT s twEnTy- FiVe ] nOoToNs ~ aNd- tHeN gAaiN s tHrEe < tImEs, uM hOw/ mUcH^ tOtAl] fOrCe \\ iS?",
  "75.00"
)

check(
  "first-char substitution: 'G hHrEe' → three (twenty-three minus seven = 16)",
  "A] lOoObbSssTtEr S^wIiMmSs/ aT- tW/eNnTy G hHrEe ] cEeMm EeTtEeR s PeR/ sEeCcoNnD, aNd- sLoWwS] bY^ sEeVvEeN { cEeMm EeTtEeR s PeR/ sEeCcoNnD, wHaT/ iS^ tHe- nEw] vEeLlOoCcIiTy?",
  "16.00"
)

check(
  "per strike: rate × count (20 × 3 = 60)",
  "A] LoOoBbSsTtEeR^ ClAaW] ExErRtS~ TwEnTy NeOoOtToOnNs/ PeR| StRrIiKkEe Um, AnDd{ ThRrEe StRrIiKkEs< , WhAaT]S ToTtAaL^ FoRrCcEe?",
  "60.00"
)
check(
  "how far: distance = speed × time (17 m/s × 3s = 51)",
  "A] lOoObBsTtEr S^wImS/ aTt SeVeNtEeN~ mE tErS| pE rS eCoNd} aNd/ sW iMs\\ fOr ThReE< sE cOnDs- , hOw{ fA r?",
  "51.00"
)

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
