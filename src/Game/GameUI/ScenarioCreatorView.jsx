import React, { useMemo, useState } from "react";
import { GAMEPLAY_PROMPT_DEFAULTS } from "../AI/gameplayPrompts.js";
import {
  actionButtonStyle,
  fieldLabelStyle,
  inputStyle,
  surfaceStyle,
  textareaStyle,
} from "./scenarioEditorStyles.js";
import { parseAdvancedPrompts } from "./scenarios.jsx";
import { exportScenarioBundle } from "../../runtime/library.js";

const HUB_NEW_POST_URL =
  "https://github.com/Open-Historia/Open-historia-scenarios/issues/new?template=scenario.yml";

// Lore templates extracted from scripts/presets/*.spec.mjs (build-time specs;
// embedded as a static object so the wizard can prefill fields without importing
// the build pipeline at runtime). Values copied verbatim from the spec files.
const LORE_TEMPLATES = [
  {
    id: "modern-day",
    name: "Modern Day (clean slate)",
    heroTitle: "",
    heroSubtitle: "",
    eyebrow: "Modern",
    subtitle: "Present Day",
    accentColor: "#7c3aed",
    gameDate: "2016-01-01",
    country: "",
    language: "English",
    description: "",
    simulationRules: "",
    startingTimelineText: "",
  },
  {
    id: "wwii-1939",
    name: "World War II — 1939",
    heroTitle: "World War II",
    heroSubtitle: "Europe on the eve of war, 1 September 1939",
    eyebrow: "Historical Preset",
    subtitle: "1 September 1939",
    accentColor: "#8a1f1f",
    gameDate: "1939-09-01",
    country: "GER",
    language: "English",
    description: `The world as the Wehrmacht crosses into Poland. The Axis is ascendant, the colonial empires span the globe, and the United States stands neutral. Lead any power through the deadliest conflict in human history.`,
    simulationRules: `It is 1 September 1939. Germany has just invaded Poland; Britain and France will declare war within 48 hours, beginning the Second World War. The Molotov–Ribbentrop Pact is in force: the USSR will invade eastern Poland on 17 September and is not yet a belligerent. The Baltic states (Estonia, Latvia, Lithuania) and Romanian Bessarabia are still independent/Romanian but will be pressured by the USSR in 1940. Italy is non-belligerent until June 1940. The United States is neutral and isolationist. Japan is two years into its war with the Republic of China: it holds Korea, Taiwan, Manchukuo, the Pacific mandates and occupied eastern China (the northern plain, the lower Yangtze, Canton and Hainan), while Chiang Kai-shek's Nationalists fight on from Chungking in the interior, with Communist guerrillas active behind Japanese lines. Mongolia is a Soviet satellite where Zhukov is beating the Japanese at Khalkhin Gol this very month. Technology and economy must reflect 1939: NO nuclear weapons (until 1945), propeller aircraft, evolving armored/blitzkrieg doctrine, battleships and carriers at sea. Colonial empires (British, French, Dutch, Belgian, Portuguese) are intact and supply manpower and resources to their mother countries. Note that the map shows modern province borders approximating 1939 control; the Polish Corridor, Danzig and the exact Sudeten line are approximate.`,
    startingTimelineText: `September 1939. At dawn the German battleship Schleswig-Holstein opens fire on the Polish garrison at Westerplatte and 1.5 million Wehrmacht troops pour across the frontier behind screaming Stukas and racing panzers — the first Blitzkrieg. In Berlin the swastika flies over a Reich that has swallowed Austria, the Sudetenland and Bohemia. In London and Paris, Chamberlain and Daladier honor their guarantee to Poland as the clocks run down to war. Stalin waits in Moscow with a secret protocol in hand; Mussolini hesitates in Rome; Roosevelt watches from a neutral America. The British and French empires still circle the globe in red and blue. The world holds its breath.`,
  },
  {
    id: "medieval-1200",
    name: "Medieval — 1200 AD",
    heroTitle: "The High Middle Ages",
    heroSubtitle: "A world of emperors, caliphs and crusaders, c. 1200",
    eyebrow: "Historical Preset",
    subtitle: "c. 1200 AD",
    accentColor: "#9a6b2f",
    gameDate: "1200-01-01",
    country: "HRE",
    language: "English",
    description: `The year 1200. The Holy Roman Empire and the Capetian kings vie for Europe, the Angevins rule from England to Aquitaine, Byzantium still stands (the Fourth Crusade has not yet come), the Almohads and Ayyubids dominate the Islamic west and east, and the Crusader states cling to the Levantine coast. Lead a kingdom, empire or caliphate through an age of faith and iron.`,
    simulationRules: `It is the year 1200, the height of the Middle Ages. Warfare is feudal: mounted knights, levied infantry, castles and sieges; there is NO gunpowder and NO standing professional army. The Holy Roman Empire is a loose confederation of princes under an elected emperor. The Angevin (Plantagenet) kings of England also hold Normandy, Anjou and Aquitaine as vassals of the French crown — a perpetual source of war (the map cannot show these French holdings; treat western France as contested between England and France). The Byzantine Empire is intact but internally weak; the Fourth Crusade's sack of Constantinople (1204) has NOT happened. The Almohads dominate the Maghreb and southern Iberia while Castile, Aragón, Navarre and Portugal press the Reconquista. The Ayyubids of Saladin's dynasty hold Egypt and Syria; the Crusader states (Jerusalem, Antioch, Tripoli, Cyprus) cling to the coast. The Abbasid Caliph in Baghdad has regained real power; the Khwarazmian Empire rises in Persia while its rival, the Ghurid Empire, has just conquered the north-Indian plain (Delhi fell in 1192). Kievan Rus' is a quarrelling family of principalities from Novgorod to Kiev; the Pontic steppe belongs to the pagan Cumans (Kipchaks) and the middle Volga to Muslim Volga Bulgaria — unclaimed steppe regions are Cuman grazing lands, not empty. In the east the Jin and Southern Song divide China, Kamakura Japan is ruled by its shogun, the Khmer Empire at Angkor rules mainland Southeast Asia, Pagan rules Burma, Dai Viet holds the Red River, and Srivijaya commands the straits of the spice trade. Religion — Latin Christianity, Orthodoxy, Sunni and Shia Islam — is the primary axis of alliance and war. Mongol unification under Temüjin (Genghis Khan) looms after 1206.`,
    startingTimelineText: `The year of grace 1200. In Rome the formidable Pope Innocent III asserts the supremacy of the Church over kings. In Paris, Philip II Augustus schemes to strip the Plantagenets of their French lands; across the Channel the lion-hearted Richard is newly dead and his brother John wears England's crown uneasily. In Constantinople the Angeloi squander the Roman inheritance as a crusader fleet gathers at Venice. Saladin's heirs quarrel over Egypt and Syria while the banners of the Cross still fly over Acre and Antioch. In Iberia the Almohad caliph holds the south against the Christian kings. Beyond the steppe, an obscure Mongol chieftain named Temüjin is uniting the tribes. An age of cathedrals, crusades and kings begins.`,
  },
  {
    id: "roman-117",
    name: "Rome — 117 AD",
    heroTitle: "The Empire at its Zenith",
    heroSubtitle: "Trajan is dead. Hadrian inherits the greatest empire the west has known.",
    eyebrow: "Historical Preset",
    subtitle: "117 AD",
    accentColor: "#a31c1c",
    gameDate: "0117-01-01",
    country: "ROM",
    language: "Latin",
    description: `The year 117. Rome rules from the Atlantic to the Tigris — Dacia conquered, Armenia and Mesopotamia annexed, Parthia beaten but unbowed. In the east the Han emperor holds the Mandate of Heaven and the Kushan kings tax the Silk Road between them. Beyond the frontiers lie the free peoples: Germania, Caledonia, the steppe. Rule an empire at its high-water mark — or the powers that wait for it to recede.`,
    simulationRules: `It is 117 AD, the high-water mark of Rome. Warfare is classical: legions and auxilia, disciplined heavy infantry, cataphract and horse-archer cavalry, siege engines, war galleys; there is NO gunpowder and NO air power. Trajan has just died (August 117) and Hadrian is newly acclaimed; historically he abandoned Mesopotamia and Armenia within a year — whether this Rome consolidates or retrenches is the player's choice. Parthia is beaten but intact beyond the Zagros and will contest Mesopotamia. The Kitos War (Jewish diaspora revolt, 115-117) is being suppressed in Egypt, Cyprus and Cyrenaica. Britain is held to the Solway-Tyne line; Caledonia is free, as is all Germania beyond Rhine and Danube, and the Sarmatian steppe. Han China under the young Emperor An rules through regents and protects the Western Regions; the Kushans tax the Silk Road between Parthia and Han; the Xiongnu press the steppe. Aksum and Himyar contest the Red Sea trade; Meroe trades and skirmishes with Roman Egypt. India is a patchwork of contending kingdoms (Satavahanas, Western Satraps, Cheras/Cholas/Pandyas) — treat it as fragmented, not empty. Unclaimed regions are tribal or stateless lands: they can be raided, colonized or federated but have no central government. Religion is pre-Christian: the imperial cult, Hellenic and eastern mysteries, Zoroastrianism in Parthia, Buddhism spreading through Kushan lands into Han China.`,
    startingTimelineText: `August, 117 AD. Word races along the imperial post roads: Trajan, Optimus Princeps, conqueror of Dacia and Ctesiphon, is dead at Selinus in Cilicia. In Antioch the armies hail his ward Hadrian as emperor. The empire he inherits has never been larger — the eagle standards stand on the Tigris, in Armenia, on the Dacian gold fields — and never more overstretched. Mesopotamia seethes, the Jewish revolt smolders from Cyrene to Cyprus, and the legions watch the Parthian king gather his cataphracts for a reckoning. Far to the east, the boy-emperor of Han rules through his regents while the Kushan lords of the Silk Road grow rich carrying silk west and gold east. Beyond every frontier wait the free peoples — Germans, Sarmatians, Caledonians — patient as winter. An age of marble and iron reaches its noon; what follows noon is the emperor's to decide.`,
  },
  {
    id: "mongol-1300",
    name: "Mongol World — 1300 AD",
    heroTitle: "The Mongol Century",
    heroSubtitle: "Four khanates rule from Korea to the Carpathians, 1300 AD",
    eyebrow: "Historical Preset",
    subtitle: "1300 AD",
    accentColor: "#c9a227",
    gameDate: "1300-01-01",
    country: "YUAN",
    language: "English",
    description: `The year 1300. The heirs of Genghis Khan rule the largest land empire in history — the Yuan emperor in Khanbaliq, the Golden Horde on the steppe, the Chagatai in Transoxiana, the Ilkhan in Persia — while Russian princes and Balkan tsars pay tribute. Beyond the hooves: Mamluk Egypt stands unbeaten, Delhi's sultan conquers India, Edward I hammers Scotland, Philip IV squeezes the Templars' France, and an obscure Ottoman beg raids the Byzantine frontier. Ride with the Horde or against it.`,
    simulationRules: `It is 1300 AD. The Mongol Empire is the largest land empire in history but is no longer one state: the Yuan Great Khan (Temur, Kublai's grandson) reigns in Khanbaliq and is acknowledged — nominally — by the Golden Horde on the western steppe, the Chagatai khans of Transoxiana and the Ilkhans of Persia, who all war among themselves (Ilkhanate vs Horde over the Caucasus, Chagatai vs Yuan over the old homeland). Warfare is feudal and steppe-nomadic: massed horse archers, heavy lancers, trebuchets, and the first Chinese gunpowder siege weapons; there is NO modern artillery and NO air power. The Russian principalities, Bulgaria and Georgia are TRIBUTARIES: self-governing but taxed and militarily answerable to their khanate overlords — treat them as vassals who dream of independence. The Mamluks of Egypt have beaten every Mongol invasion of Syria (Ain Jalut 1260, and they will win again at Marj al-Saffar 1303) — the Ilkhan-Mamluk war is the era's defining front, and the Ilkhans court Christian Europe as allies against it. Alauddin Khalji's Delhi is conquering India and will soon raid the Deccan kingdoms (Yadava, Kakatiya, Hoysala, Pandya). In Anatolia the Seljuk rump serves the Ilkhan while coastal beyliks slip loose — among them Osman's tiny Ottoman beylik, founded c. 1299, which history will make an empire. In Europe: Edward I fights Scotland, Philip IV of France feuds with Pope Boniface VIII, the Sicilian Vespers war splits Naples (Anjou) from island Sicily (Aragon), and pagan Lithuania resists the Teutonic Order. Kamakura Japan has repelled two Mongol invasions (1274, 1281). Unclaimed regions are tribal or stateless lands — steppe, forest, desert — raidable and colonizable but ungoverned.`,
    startingTimelineText: `The year 1300. From the Pacific to the Carpathians the descendants of Genghis Khan divide the world's greatest empire. In Khanbaliq, Temur Khan holds his grandfather Kublai's throne; on the Volga, Toqta rules the Golden Horde and counts the tribute of Russian princes; in Tabriz the Ilkhan Ghazan, newly Muslim, plans one more march on Mamluk Syria. Cairo's slave-soldier sultans remain the one power the Mongols never broke. In Delhi, Alauddin Khalji sharpens his armies for the conquest of the south. In Rome, Boniface VIII proclaims the first Jubilee as kings in Paris and London tax their clergy for war. On a hillside in Bithynia, a Turkish beg named Osman watches the Byzantine frontier and dreams. The world belongs to the horse — for now.`,
  },
  {
    id: "colonial-1650",
    name: "New World — 1650",
    heroTitle: "The Colonization of the New World",
    heroSubtitle: "Empires of sail and the nations that met them, 1650 AD",
    eyebrow: "Historical Preset",
    subtitle: "1650 AD",
    accentColor: "#2e6b8a",
    gameDate: "1650-01-01",
    country: "GBR",
    language: "English",
    description: `The year 1650. Spanish silver fleets sail from two viceroyalties, Portugal fights the Dutch for Brazil, republican England plants colonies from Massachusetts to Barbados, and France trades furs up the St Lawrence. But most of the Americas still belong to the nations that were always there — Haudenosaunee, Cherokee, Sioux, Apache, Maya, Mapuche. Build an empire across the ocean, or drive one back into it.`,
    simulationRules: `It is 1650, the height of the first colonial age. Warfare is pike-and-shot: matchlock muskets, pikes, siege cannon and ships of the line; armies are small and oceans are slow — a crossing takes 6-10 weeks, and colonial ventures live or die by supply fleets. NO industrial technology. Spain's two viceroyalties (New Spain and Peru) ship silver convoys that everyone else's privateers hunt. Portugal, independent of Spain again since 1640, is at war with the Dutch West India Company for the Brazilian northeast (Recife falls to Portugal in 1654). England is a REPUBLIC — Charles I was beheaded in 1649 and Cromwell's Commonwealth is subduing Ireland and will pass the Navigation Act (1651), lighting the fuse of the Anglo-Dutch wars. New France is a fur empire of a few thousand colonists allied to the Huron and Algonquin; New Netherland and tiny New Sweden trade on the Hudson and Delaware. NATIVE NATIONS ARE REAL POWERS: the Haudenosaunee (Iroquois) are mid-Beaver-Wars — they destroyed Huronia in 1649 and dominate the eastern woodlands with Dutch muskets; the Mapuche have beaten Spain at the Biobio frontier for a century; the Itza Maya of Peten remain unconquered until 1697; the Sioux, Apache, Navajo, Cherokee, Muscogee and Choctaw control the interior. Horses are only now spreading north from New Mexico. Unclaimed regions are native homelands or unexplored country — entering them means diplomacy or war with peoples who know the ground. Disease is the colonizers' cruelest weapon and should shadow every contact. In Europe the Thirty Years' War just ended (Westphalia 1648), the Khmelnytsky uprising tears at Poland-Lithuania, and the Fronde paralyzes France. The Qing have taken Beijing (1644) and are hunting the Ming remnant; Japan is closed (sakoku); the VOC rules the spice trade from Batavia and Dutch Formosa.`,
    startingTimelineText: `The year 1650. In London a king's severed head has made England a republic, and Cromwell's Ironsides are in Ireland. In Madrid the silver of Potosi and Zacatecas still buys armies, though the treasure fleets sail through seas thick with enemies. In Recife the Dutch cling to their Brazilian conquest as Portuguese planters rise against them. On the St Lawrence, Quebec mourns the Huron nation, shattered last year by Haudenosaunee war parties armed with Dutch muskets — the Beaver Wars have made the Five Nations the terror of the woodlands. On Manhattan island, Stuyvesant counts furs; on the Delaware, a few hundred Swedes hold Fort Christina; at Santa Fe and San Agustin, Spain's frontier priests and soldiers hold the edge of empire. South of the Biobio the Mapuche sharpen their lances, unbeaten. Two worlds have met, and neither will yield the continent without a fight.`,
  },
  {
    id: "bronze-1200bc",
    name: "Bronze Age — 1200 BC",
    heroTitle: "Before the Collapse",
    heroSubtitle: "The palaces still stand. The Sea Peoples are coming.",
    eyebrow: "Historical Preset",
    subtitle: "c. 1200 BC",
    accentColor: "#c28a2e",
    gameDate: "1200 BCE",
    country: "EGYP",
    language: "English",
    description: `The Late Bronze Age at its height. Pharaoh rules from Nubia to Canaan, trading brother-to-brother with the Great Kings of Hatti, Babylon and Assyria. Bronze — and the tin it demands — binds an international system of palaces, chariots and scribes from Mycenae to Susa. But the harvests are failing, the Sea Peoples are stirring, and within a generation almost every palace on this map will burn. Hold the old world together as Egypt, break it as the raiders, or rise from its ashes.`,
    simulationRules: `It is roughly 1200 BC, the last high summer of the Late Bronze Age. Warfare is bronze spears and composite bows; the decisive arm is the CHARIOT (treat 'armor' as chariotry) with massed runners in support; navies are oared galleys; sieges are blockade and escalade — there is NO iron weaponry at scale, NO cavalry, NO siege artillery, NO coinage (wealth moves as grain, copper, tin, gold and cloth). Great-power diplomacy is the Amarna system: the kings of Egypt, Hatti, Babylon, Assyria and Elam write to each other as 'brother', exchange royal daughters and gifts, and jealously guard who may be called Great King. Egypt and Hatti are at peace under the Treaty of Kadesh (1259 BC); Assyria under Tukulti-Ninurta I is aggressive and has recently humbled Babylon; Elam is rising. The system is FRAGILE: harvests are failing, tin routes are long, palace economies are over-centralized. The Sea Peoples — displaced Aegean and Anatolian raiders — will begin striking coasts within years; drought, earthquakes and migrations should steadily stress every palace state (the historical Bronze Age Collapse, c. 1200-1150 BC). Mycenaean palaces, Hattusa and Ugarit historically burned within fifty years; Egypt survives but is diminished — the player may resist, redirect or exploit the collapse. Unclaimed regions are tribal or stateless (Aramaean and Phrygian migrants, Sherden and Lukka sea-raiders, steppe herders, Vedic clans in India, village Europe); they can be raided, settled or federated but have no central government. Religion is polytheist everywhere: Amun-Ra and the Aten's memory in Egypt, the Storm God of Hatti, Marduk in Babylon, Ashur in Assyria, ancestor oracle-bones in Shang China. Dates are BCE and count DOWN (1200 BCE, then 1199 BCE...); write dates as e.g. '1198 BCE'.`,
    startingTimelineText: `The year is 1200 BCE. In Pi-Ramesses the court of Pharaoh still gleams — tribute barges from Kush, cedar from Byblos, letters of brotherhood from Hattusa and Babylon written in the scribes' cuneiform. The Treaty with Hatti has held for two generations; the garrisons of Canaan collect their grain; the world of bronze seems eternal. But the reports darken year by year: harvests fail in Anatolia and Hatti begs Egypt for grain ships; strange sails — Sherden, Lukka, Peleset — harry the coasts; Aramaean herders press the Euphrates towns; in the north the Assyrian king boasts of conquests and calls himself Great King. Far beyond the horizon, oracle bones crack in the temples of Yin and stone heads rise in the jungles of the Olmec. The old world has perhaps a generation left. What Pharaoh does with it — history is waiting to find out.`,
  },
];

const WIZARD_STEPS = [
  { id: "carte", label: "Carte", hint: "Map & assets" },
  { id: "lore", label: "Lore", hint: "Metadata & world" },
  { id: "ai", label: "Instructions IA", hint: "Advisor, leader & advanced pack" },
  { id: "review", label: "Review & Save", hint: "Summary & publish" },
];

const sectionCardStyle = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "18px",
  marginBottom: "0.95rem",
  padding: "0.9rem",
};

const gridStyle = {
  display: "grid",
  gap: "0.8rem",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
};

const fullSpanStyle = { gridColumn: "1 / -1" };

const errorBannerStyle = {
  background: "rgba(248,113,113,0.12)",
  border: "1px solid rgba(248,113,113,0.34)",
  borderRadius: "14px",
  color: "#fecaca",
  marginBottom: "0.9rem",
  padding: "0.8rem 0.9rem",
};

const warnBannerStyle = {
  background: "rgba(234,179,8,0.1)",
  border: "1px solid rgba(234,179,8,0.3)",
  borderRadius: "14px",
  color: "#fde68a",
  marginBottom: "0.9rem",
  padding: "0.8rem 0.9rem",
  fontSize: "0.82rem",
};

const presetPickerStyle = {
  ...inputStyle,
  cursor: "pointer",
};

const stepRailItem = (active, completed) => ({
  ...actionButtonStyle,
  alignItems: "flex-start",
  background: active ? "rgba(124,58,237,0.22)" : "rgba(255,255,255,0.04)",
  borderColor: active ? "rgba(124,58,237,0.45)" : "rgba(255,255,255,0.08)",
  color: active ? "#fff" : completed ? "rgba(244,246,255,0.82)" : "rgba(255,255,255,0.6)",
  flexDirection: "column",
  gap: "0.15rem",
  justifyContent: "flex-start",
  minHeight: "3rem",
  padding: "0.65rem 0.8rem",
  textAlign: "left",
  whiteSpace: "normal",
});

const FONT_OPTIONS = [
  "Impact", "Arial Black", "Arial", "Georgia", "Times New Roman",
  "Trebuchet MS", "Verdana", "Courier New", "Garamond", "Comic Sans MS",
];

const colorInputStyle = {
  ...inputStyle,
  height: "2.6rem",
  padding: "0.2rem",
};

// Validate ISO-ish date: YYYY-MM-DD, YYYY-MM, YYYY, "YYYY BCE", or "YYYY AD".
const isValidGameDate = (value) => {
  const v = String(value ?? "").trim();
  if (!v) return false;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return true;
  if (/^\d{4}-\d{2}$/.test(v)) return true;
  if (/^\d{4}$/.test(v)) return true;
  if (/^\d{1,4}\s*(BCE|BC|AD|CE)$/i.test(v)) return true;
  return false;
};

const isEmpty = (value) => !String(value ?? "").trim();

const Field = ({ label, children, span }) => (
  <div style={span ? fullSpanStyle : undefined}>
    <label style={fieldLabelStyle}>{label}</label>
    {children}
  </div>
);

const ScenarioCreatorView = ({
  details,
  editorError,
  fileInputsRef,
  formState,
  isBusy,
  onChange,
  onClearAsset,
  onClose,
  onDelete,
  onFileSelect,
  onOpenFileDialog,
  onOpenMapEditor,
  onSave,
  onSetActive,
}) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [aiTab, setAiTab] = useState("advisor");
  const [advancedError, setAdvancedError] = useState(null);

  if (!details || !formState) {
    return null;
  }

  const scenario = details.scenario ?? {};
  const assetStatus = details.assetStatus ?? {};
  const world = details.data?.world ?? {};

  // Live-parse the advanced JSON so the IA step and the Review step can surface
  // errors inline instead of only failing at save time.
  const advancedParseResult = useMemo(() => {
    try {
      parseAdvancedPrompts(formState.advancedPromptsText);
      return { ok: true, error: null };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }, [formState.advancedPromptsText]);

  const nameValid = !isEmpty(formState.name);
  const dateValid = isValidGameDate(formState.gameDate);
  const advancedValid = advancedParseResult.ok;

  const allValid = nameValid && dateValid && advancedValid;

  const visibleWarnings = useMemo(() => {
    const next = [];
    if (isEmpty(formState.startingTimelineText)) {
      next.push("World Before Round One is empty — the AI will have no opening briefing.");
    }
    if (isEmpty(formState.simulationRules)) {
      next.push("Simulation Rules is empty — the AI will have no era/world constraints.");
    }
    return next;
  }, [formState.startingTimelineText, formState.simulationRules]);

  const restoreAdvancedDefaults = () => {
    onChange("advancedPromptsText", JSON.stringify(GAMEPLAY_PROMPT_DEFAULTS, null, 2));
    setAdvancedError(null);
  };

  const restoreAdvisorDefault = () => {
    // Blank = fall back to the built-in defaultPrompts.json advisor.
    onChange("systemPrompt", "");
  };

  const restoreLeaderDefault = () => {
    // Blank = fall back to the built-in defaultPrompts.json leader.
    onChange("leaderPrompt", "");
  };

  const loadTemplate = (templateId) => {
    const tmpl = LORE_TEMPLATES.find((t) => t.id === templateId);
    if (!tmpl) return;

    // Confirm before overwriting non-empty fields.
    const fields = [
      "name", "eyebrow", "accentColor", "subtitle", "description",
      "heroTitle", "heroSubtitle", "country", "gameDate", "language",
      "simulationRules", "startingTimelineText",
    ];
    const nonEmpty = fields.filter((f) => !isEmpty(formState[f]));
    const proceed = nonEmpty.length === 0
      || window.confirm(
        `Load "${tmpl.name}"? This will overwrite ${nonEmpty.length} non-empty field${nonEmpty.length === 1 ? "" : "s"} (name, eyebrow, accent, subtitle, description, hero, country, date, language, rules).`,
      );
    if (!proceed) return;

    onChange("name", tmpl.name);
    onChange("eyebrow", tmpl.eyebrow);
    onChange("accentColor", tmpl.accentColor);
    onChange("subtitle", tmpl.subtitle);
    onChange("description", tmpl.description);
    onChange("heroTitle", tmpl.heroTitle);
    onChange("heroSubtitle", tmpl.heroSubtitle);
    onChange("country", tmpl.country);
    onChange("gameDate", tmpl.gameDate);
    onChange("language", tmpl.language);
    onChange("simulationRules", tmpl.simulationRules);
    onChange("startingTimelineText", tmpl.startingTimelineText);
  };

  const handlePublish = async () => {
    try {
      // Export the scenario bundle and open a prefilled hub post.
      await exportScenarioBundle(details.scenario.id, "light");
      const scenarioUrl =
        `${HUB_NEW_POST_URL}&title=${encodeURIComponent(`[Scenario] ${formState.name || scenario.name}`)}`;
      window.open(scenarioUrl, "_blank", "noopener");
    } catch (err) {
      // Surface through the parent error banner; keep going so the post opens.
      window.open(HUB_NEW_POST_URL, "_blank", "noopener");
    }
  };

  const step = WIZARD_STEPS[stepIndex];

  const goNext = () => setStepIndex((i) => Math.min(i + 1, WIZARD_STEPS.length - 1));
  const goBack = () => setStepIndex((i) => Math.max(i - 1, 0));

  const sidebarStyle = {
    ...surfaceStyle,
    borderRadius: "18px",
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
    height: "fit-content",
    padding: "0.8rem",
    position: "sticky",
    top: "0.8rem",
    width: "10rem",
  };

  const renderCarteStep = () => {
    // Summarize the scenario's current map assets if available from details.
    const assetCounts = Object.entries(assetStatus)
      .filter(([, v]) => v)
      .map(([k]) => k);
    const hasCustomRegions = Boolean(world.customRegions);
    const basemap = world.basemap || null;

    return (
      <>
        <div style={sectionCardStyle}>
          <div style={{ fontSize: "0.76rem", fontWeight: 700, letterSpacing: "0.08em", marginBottom: "0.75rem", textTransform: "uppercase" }}>
            Current Map
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <div style={{ color: "rgba(255,255,255,0.72)", fontSize: "0.85rem" }}>
              {hasCustomRegions
                ? "This scenario has a custom map (region geometry + ownership overrides)."
                : "Using the default world map (no custom geometry)."}
            </div>
            {basemap && (
              <div style={{ color: "rgba(255,255,255,0.58)", fontSize: "0.8rem" }}>
                Basemap: {typeof basemap === "string" ? basemap : basemap.kind || "custom"}
              </div>
            )}
            {assetCounts.length > 0 && (
              <div style={{ color: "rgba(255,255,255,0.58)", fontSize: "0.8rem" }}>
                Asset overrides: {assetCounts.join(", ")}
              </div>
            )}
          </div>
        </div>

        <div style={sectionCardStyle}>
          <div style={{ fontSize: "0.76rem", fontWeight: 700, letterSpacing: "0.08em", marginBottom: "0.75rem", textTransform: "uppercase" }}>
            Map Editor
          </div>
          <div style={{ color: "rgba(255,255,255,0.58)", fontSize: "0.82rem", lineHeight: 1.5, marginBottom: "0.8rem" }}>
            Open the full map editor to draw custom regions, set country ownership, place cities and choose a basemap. Changes apply directly to this scenario.
          </div>
          <button
            onClick={onOpenMapEditor}
            style={{ ...actionButtonStyle, background: "rgba(124,58,237,0.24)", borderColor: "rgba(124,58,237,0.38)", color: "#fff", minWidth: "9rem" }}
            type="button"
          >
            🗺️ Open Map Editor
          </button>
        </div>

        <div style={sectionCardStyle}>
          <div style={{ fontSize: "0.76rem", fontWeight: 700, letterSpacing: "0.08em", marginBottom: "0.75rem", textTransform: "uppercase" }}>
            Asset Overrides
          </div>
          <div style={{ display: "grid", gap: "0.7rem" }}>
            {Object.entries({
              cities: "Cities PMTiles",
              colors: "Colors JSON",
              countries: "Countries PMTiles",
              regions: "Regions PMTiles",
            }).map(([assetKey, label]) => (
              <div key={assetKey} style={{ alignItems: "center", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", display: "flex", gap: "0.75rem", justifyContent: "space-between", padding: "0.72rem 0.78rem" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: "0.9rem", fontWeight: 600 }}>{label}</div>
                  <div style={{ color: "rgba(255,255,255,0.58)", fontSize: "0.78rem", marginTop: "0.15rem" }}>
                    {assetStatus[assetKey] ? "Stored on the server for this scenario" : "Using base asset"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "0.45rem" }}>
                  <button onClick={() => onOpenFileDialog(assetKey)} style={actionButtonStyle} type="button">Upload</button>
                  <button
                    onClick={() => onClearAsset(assetKey)}
                    style={{ ...actionButtonStyle, background: "rgba(255,255,255,0.03)", color: assetStatus[assetKey] ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.35)" }}
                    disabled={!assetStatus[assetKey]}
                    type="button"
                  >
                    Reset
                  </button>
                  <input
                    ref={(node) => { fileInputsRef.current[assetKey] = node; }}
                    accept={assetKey === "colors" ? ".json" : ".pmtiles"}
                    onChange={(event) => onFileSelect(assetKey, event)}
                    style={{ display: "none" }}
                    type="file"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </>
    );
  };

  const renderLoreStep = () => (
    <>
      <div style={sectionCardStyle}>
        <div style={{ alignItems: "center", display: "flex", gap: "0.8rem", justifyContent: "space-between", marginBottom: "0.75rem", flexWrap: "wrap" }}>
          <div style={{ fontSize: "0.76rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Load Template
          </div>
          <select
            value=""
            onChange={(event) => { if (event.target.value) loadTemplate(event.target.value); }}
            style={presetPickerStyle}
          >
            <option value="">Choose a lore preset…</option>
            {LORE_TEMPLATES.map((tmpl) => (
              <option key={tmpl.id} value={tmpl.id}>{tmpl.name}</option>
            ))}
          </select>
        </div>
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.78rem", lineHeight: 1.5 }}>
          Prefills name, eyebrow, accent, subtitle, description, hero copy, country, date, language, simulation rules and the world briefing. Confirms before overwriting non-empty fields.
        </div>
      </div>

      <div style={sectionCardStyle}>
        <div style={gridStyle}>
          <Field label="Name" span>
            <input style={inputStyle} value={formState.name} onChange={(e) => onChange("name", e.target.value)} />
          </Field>
          <Field label="Eyebrow">
            <input style={inputStyle} value={formState.eyebrow} onChange={(e) => onChange("eyebrow", e.target.value)} />
          </Field>
          <Field label="Accent">
            <input style={colorInputStyle} type="color" value={formState.accentColor} onChange={(e) => onChange("accentColor", e.target.value)} />
          </Field>
          <Field label="Subtitle" span>
            <input style={inputStyle} value={formState.subtitle} onChange={(e) => onChange("subtitle", e.target.value)} />
          </Field>
          <Field label="Description" span>
            <textarea style={{ ...textareaStyle, minHeight: "6.5rem" }} value={formState.description} onChange={(e) => onChange("description", e.target.value)} />
          </Field>
          <Field label="Hero Title" span>
            <input style={inputStyle} value={formState.heroTitle} onChange={(e) => onChange("heroTitle", e.target.value)} />
          </Field>
          <Field label="Hero Subtitle" span>
            <textarea style={{ ...textareaStyle, minHeight: "5.5rem" }} value={formState.heroSubtitle} onChange={(e) => onChange("heroSubtitle", e.target.value)} />
          </Field>
        </div>
      </div>

      <div style={sectionCardStyle}>
        <div style={gridStyle}>
          <Field label="Player Country">
            <input style={inputStyle} value={formState.country} onChange={(e) => onChange("country", e.target.value)} />
          </Field>
          <Field label="Game Date">
            <input style={inputStyle} value={formState.gameDate} onChange={(e) => onChange("gameDate", e.target.value)} placeholder="YYYY-MM-DD or 1200 BCE" />
          </Field>
          <Field label="Language">
            <input style={inputStyle} value={formState.language} onChange={(e) => onChange("language", e.target.value)} />
          </Field>
          <Field label="Country Label Font">
            <input list="oh-scenario-font-options" placeholder="Impact (default)" style={inputStyle} value={formState.labelFont} onChange={(e) => onChange("labelFont", e.target.value)} />
            <datalist id="oh-scenario-font-options">
              {FONT_OPTIONS.map((font) => <option key={font} value={font} />)}
            </datalist>
          </Field>
          <Field label="Label Letter Color">
            <input type="color" style={colorInputStyle} value={/^#[0-9a-fA-F]{6}$/.test(formState.labelTextColor) ? formState.labelTextColor : "#ffffff"} onChange={(e) => onChange("labelTextColor", e.target.value)} />
          </Field>
          <Field label="Label Border Color">
            <input type="color" style={colorInputStyle} value={/^#[0-9a-fA-F]{6}$/.test(formState.labelHaloColor) ? formState.labelHaloColor : "#000000"} onChange={(e) => onChange("labelHaloColor", e.target.value)} />
          </Field>
          <Field label="World Before Round One" span>
            <textarea style={{ ...textareaStyle, minHeight: "8rem" }} value={formState.startingTimelineText} onChange={(e) => onChange("startingTimelineText", e.target.value)} />
          </Field>
          <Field label="Simulation Rules" span>
            <textarea style={{ ...textareaStyle, minHeight: "8rem" }} value={formState.simulationRules} onChange={(e) => onChange("simulationRules", e.target.value)} />
          </Field>
        </div>
      </div>
    </>
  );

  const renderAiStep = () => {
    const tabs = [
      { id: "advisor", label: "Advisor" },
      { id: "leader", label: "Leader" },
      { id: "advanced", label: "Advanced Pack" },
    ];

    return (
      <>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem", marginBottom: "0.85rem" }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setAiTab(tab.id)}
              style={{
                ...actionButtonStyle,
                background: aiTab === tab.id ? "rgba(124,58,237,0.28)" : "rgba(255,255,255,0.05)",
                borderColor: aiTab === tab.id ? "rgba(124,58,237,0.42)" : "rgba(255,255,255,0.08)",
                minHeight: "2rem",
                padding: "0 0.8rem",
              }}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>

        {aiTab === "advisor" && (
          <div style={sectionCardStyle}>
            <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between", marginBottom: "0.6rem" }}>
              <label style={fieldLabelStyle}>Advisor Prompt</label>
              <button onClick={restoreAdvisorDefault} style={{ ...actionButtonStyle, minHeight: "1.8rem", padding: "0 0.7rem", fontSize: "0.75rem" }} type="button">
                Restore defaults
              </button>
            </div>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.78rem", marginBottom: "0.6rem" }}>
              Blank = use the built-in advisor prompt from defaultPrompts.json.
            </div>
            <textarea style={textareaStyle} value={formState.systemPrompt} onChange={(e) => onChange("systemPrompt", e.target.value)} />
          </div>
        )}

        {aiTab === "leader" && (
          <div style={sectionCardStyle}>
            <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between", marginBottom: "0.6rem" }}>
              <label style={fieldLabelStyle}>Leader Prompt</label>
              <button onClick={restoreLeaderDefault} style={{ ...actionButtonStyle, minHeight: "1.8rem", padding: "0 0.7rem", fontSize: "0.75rem" }} type="button">
                Restore defaults
              </button>
            </div>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.78rem", marginBottom: "0.6rem" }}>
              Blank = use the built-in leader prompt from defaultPrompts.json.
            </div>
            <textarea style={{ ...textareaStyle, minHeight: "11rem" }} value={formState.leaderPrompt} onChange={(e) => onChange("leaderPrompt", e.target.value)} />
          </div>
        )}

        {aiTab === "advanced" && (
          <div style={sectionCardStyle}>
            <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between", marginBottom: "0.6rem" }}>
              <label style={fieldLabelStyle}>Advanced AI Prompt Pack (JSON)</label>
              <button onClick={restoreAdvancedDefaults} style={{ ...actionButtonStyle, minHeight: "1.8rem", padding: "0 0.7rem", fontSize: "0.75rem" }} type="button">
                Restore defaults
              </button>
            </div>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.78rem", marginBottom: "0.6rem" }}>
              A JSON object of the 11 gameplay task prompts. Defaults come from GAMEPLAY_PROMPT_DEFAULTS.
            </div>
            <textarea
              style={{ ...textareaStyle, minHeight: "16rem", fontFamily: "Consolas, monospace", fontSize: "0.8rem" }}
              value={formState.advancedPromptsText}
              onChange={(e) => onChange("advancedPromptsText", e.target.value)}
            />
            {!advancedValid && (
              <div style={{ ...errorBannerStyle, marginTop: "0.8rem" }}>
                {advancedParseResult.error}
              </div>
            )}
          </div>
        )}
      </>
    );
  };

  const renderReviewStep = () => {
    const summaryRow = (label, value, invalid) => (
      <div style={{ display: "flex", gap: "0.6rem", padding: "0.45rem 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.04em", minWidth: "10rem", textTransform: "uppercase" }}>{label}</div>
        <div style={{ color: invalid ? "#fca5a5" : "rgba(255,255,255,0.85)", fontSize: "0.88rem", flex: 1, whiteSpace: "pre-wrap" }}>
          {value || (invalid ? "(required)" : "(empty)")}
        </div>
      </div>
    );

    return (
      <>
        {visibleWarnings.length > 0 && (
          <div style={warnBannerStyle}>
            {visibleWarnings.map((w) => <div key={w}>⚠️ {w}</div>)}
          </div>
        )}

        <div style={sectionCardStyle}>
          <div style={{ fontSize: "0.76rem", fontWeight: 700, letterSpacing: "0.08em", marginBottom: "0.75rem", textTransform: "uppercase" }}>
            Metadata
          </div>
          {summaryRow("Name", formState.name, !nameValid)}
          {summaryRow("Eyebrow", formState.eyebrow)}
          {summaryRow("Accent", formState.accentColor)}
          {summaryRow("Subtitle", formState.subtitle)}
          {summaryRow("Description", formState.description)}
          {summaryRow("Hero Title", formState.heroTitle)}
          {summaryRow("Hero Subtitle", formState.heroSubtitle)}
        </div>

        <div style={sectionCardStyle}>
          <div style={{ fontSize: "0.76rem", fontWeight: 700, letterSpacing: "0.08em", marginBottom: "0.75rem", textTransform: "uppercase" }}>
            World
          </div>
          {summaryRow("Player Country", formState.country)}
          {summaryRow("Game Date", formState.gameDate, !dateValid)}
          {summaryRow("Language", formState.language)}
          {summaryRow("Label Font", formState.labelFont)}
          {summaryRow("Label Letter Color", formState.labelTextColor)}
          {summaryRow("Label Border Color", formState.labelHaloColor)}
          {summaryRow("World Before R1", formState.startingTimelineText ? `${formState.startingTimelineText.slice(0, 120)}…` : "", isEmpty(formState.startingTimelineText))}
          {summaryRow("Simulation Rules", formState.simulationRules ? `${formState.simulationRules.slice(0, 120)}…` : "", isEmpty(formState.simulationRules))}
        </div>

        <div style={sectionCardStyle}>
          <div style={{ fontSize: "0.76rem", fontWeight: 700, letterSpacing: "0.08em", marginBottom: "0.75rem", textTransform: "uppercase" }}>
            AI Prompts
          </div>
          {summaryRow("Advisor", formState.systemPrompt ? "(custom)" : "(built-in default)")}
          {summaryRow("Leader", formState.leaderPrompt ? "(custom)" : "(built-in default)")}
          {summaryRow("Advanced Pack", advancedValid ? "valid JSON" : "INVALID JSON", !advancedValid)}
        </div>

        {(editorError || advancedError) && (
          <div style={errorBannerStyle}>
            {editorError || advancedError}
          </div>
        )}

        <div style={sectionCardStyle}>
          <div style={{ fontSize: "0.76rem", fontWeight: 700, letterSpacing: "0.08em", marginBottom: "0.75rem", textTransform: "uppercase" }}>
            Actions
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.55rem" }}>
            <button
              onClick={onSave}
              style={{ ...actionButtonStyle, background: `${scenario.accentColor}cc`, borderColor: `${scenario.accentColor}dd`, color: "#fff", minWidth: "7.2rem" }}
              disabled={!allValid || isBusy}
              type="button"
            >
              {isBusy ? "Saving..." : "Save"}
            </button>
            <button onClick={onSetActive} style={actionButtonStyle} type="button">
              Activate
            </button>
            <button onClick={handlePublish} style={{ ...actionButtonStyle, background: "rgba(124,58,237,0.3)", borderColor: "rgba(124,58,237,0.5)" }} type="button">
              ⬆ Publish to Hub
            </button>
            {scenario.canDelete && (
              <button
                onClick={onDelete}
                style={{ ...actionButtonStyle, background: "rgba(127,29,29,0.34)", borderColor: "rgba(248,113,113,0.28)", color: "#fecaca" }}
                type="button"
              >
                Delete
              </button>
            )}
          </div>
          {!allValid && (
            <div style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.78rem", marginTop: "0.7rem" }}>
              Fix the highlighted fields above before saving.
            </div>
          )}
        </div>
      </>
    );
  };

  const stepBody = step.id === "carte" ? renderCarteStep()
    : step.id === "lore" ? renderLoreStep()
    : step.id === "ai" ? renderAiStep()
    : renderReviewStep();

  return (
    <div
      style={{
        background: "rgba(5,8,18,0.97)",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        fontFamily: "sans-serif",
        inset: 0,
        overflow: "hidden",
        position: "fixed",
        zIndex: 10060,
      }}
    >
      {/* Header */}
      <div
        style={{
          alignItems: "center",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          flexShrink: 0,
          gap: "0.8rem",
          height: "3.5rem",
          justifyContent: "space-between",
          padding: "0 1rem",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.72rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Scenario Studio
          </div>
          <div style={{ fontSize: "1.2rem", fontWeight: 800, letterSpacing: "-0.03em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {formState.name || scenario.name || "Untitled Scenario"}
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {stepIndex > 0 && (
            <button onClick={goBack} style={actionButtonStyle} type="button">
              ← Back
            </button>
          )}
          {stepIndex < WIZARD_STEPS.length - 1 && (
            <button
              onClick={goNext}
              style={{ ...actionButtonStyle, background: "rgba(124,58,237,0.3)", borderColor: "rgba(124,58,237,0.5)" }}
              type="button"
            >
              Next →
            </button>
          )}
          <button
            onClick={onClose}
            style={{ ...actionButtonStyle, background: "rgba(255,255,255,0.04)", minWidth: "2.35rem", padding: 0 }}
            type="button"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Body: sidebar + main panel */}
      <div style={{ display: "flex", flex: 1, gap: "0.8rem", overflow: "hidden", padding: "0.8rem" }}>
        <div style={{ flexShrink: 0, overflowY: "auto" }}>
          <div style={sidebarStyle}>
            {WIZARD_STEPS.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setStepIndex(i)}
                style={stepRailItem(i === stepIndex, false)}
                type="button"
              >
                <span style={{ fontSize: "0.9rem", fontWeight: 700 }}>{i + 1}. {s.label}</span>
                <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.68rem", fontWeight: 500, letterSpacing: "0", textTransform: "none" }}>
                  {s.hint}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", paddingRight: "0.2rem" }}>
          {stepBody}
        </div>
      </div>
    </div>
  );
};

export default ScenarioCreatorView;
