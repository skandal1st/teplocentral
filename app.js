const express = require("express");
const path = require("path");
const fs = require("fs");
const session = require("express-session");
const multer = require("multer");

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, "data");
const CONTENT_FILE = path.join(DATA_DIR, "content.json");
const FILES_FILE = path.join(DATA_DIR, "files.json");
const UPLOADS_DIR = path.join(__dirname, "uploads");

const SECTION_KEYS = [
  "contacts",
  "procurement",
  "products_services",
  "disclosure",
  "union",
  "vacancies",
];

const SECTION_ROUTE_MAP = {
  contacts: "/contacts",
  procurement: "/procurement",
  products_services: "/products-services",
  disclosure: "/disclosure",
  union: "/union",
  vacancies: "/vacancies",
};

const DEFAULT_CONTENT = {
  siteTitle: "Теплоцентраль",
  heroTitle: "Муниципальное предприятие теплоснабжения и водоотведения",
  heroSubtitle:
    "Обеспечиваем надежное отопление, водоснабжение и водоотведение для жителей и организаций.",
  emergencyContacts: [
    { label: "Аварийная служба", value: "+7 (498) 484-44-82" },
    { label: "Теплоснабжение", value: "+7 (498) 484-73-31" },
    { label: "Водоснабжение", value: "+7 (498) 484-73-32" },
    { label: "Почта", value: "info@teplocentral.org" },
  ],
  news: [
    {
      id: "default-1",
      title: "Профилактические работы в центральном тепловом пункте",
      excerpt: "С 10 по 12 мая будут выполняться регламентные работы. Подача услуг в указанный период сохраняется в штатном режиме.",
      body: "",
      cover: "",
      date: "20.04.2026",
      link: "/news/default-1",
    },
    {
      id: "default-2",
      title: "Опубликован график подготовки к отопительному сезону",
      excerpt: "Размещен план ремонтов и модернизации оборудования на межотопительный период с детализацией по объектам.",
      body: "",
      cover: "",
      date: "18.04.2026",
      link: "/news/default-2",
    },
    {
      id: "default-3",
      title: "Обновлен раздел по раскрытию информации",
      excerpt: "Добавлены новые документы, тарифные материалы и сведения о технических показателях предприятия.",
      body: "",
      cover: "",
      date: "15.04.2026",
      link: "/news/default-3",
    },
  ],
  vacancies: [],
  vacanciesApplyUrl: "https://hh.ru/",
  productsServicesDocuments: [],
  disclosureDocuments: [],
  sections: {
    contacts: {
      title: "Контакты",
      image: "",
      content:
        "<p><strong>Адрес:</strong> Московская область, г. Пример, ул. Центральная, д. 1</p><p><strong>Телефон:</strong> +7 (000) 000-00-00</p><p><strong>Email:</strong> info@teplocentral.org</p>",
    },
    procurement: {
      title: "Закупки",
      image: "",
      content:
        "<p>Публикация планов закупок, извещений и результатов проводится в соответствии с действующим законодательством.</p>",
    },
    products_services: {
      title: "Информация о товарах и услугах",
      image: "",
      content:
        "<p>Здесь размещается информация о предоставляемых услугах, тарифах, условиях подключения и порядке расчетов.</p>",
    },
    disclosure: {
      title: "Раскрытие информации",
      image: "",
      content:
        "<p>Раздел для размещения обязательной информации в рамках стандартов раскрытия данных ресурсоснабжающими организациями.</p>",
    },
    union: {
      title: "Профсоюз",
      image: "",
      content:
        "<p>Информация о деятельности профсоюзной организации предприятия, мероприятиях и социальных гарантиях сотрудников.</p>",
    },
    vacancies: {
      title: "Вакансии",
      image: "",
      content:
        "<p>Актуальные вакансии, требования к кандидатам и контакты для отклика.</p>",
    },
  },
};

function withDefaultItems(items, defaults) {
  const source = Array.isArray(items) ? items : [];
  return defaults.map((defaultItem, index) => ({
    ...defaultItem,
    ...(source[index] || {}),
  }));
}

function normalizeContentShape(content) {
  const merged = {
    ...DEFAULT_CONTENT,
    ...content,
    sections: {
      ...DEFAULT_CONTENT.sections,
      ...(content?.sections || {}),
    },
  };

  merged.emergencyContacts = withDefaultItems(
    content?.emergencyContacts,
    DEFAULT_CONTENT.emergencyContacts
  );

  // News: variable-length array, assign id to legacy items
  const rawNews = Array.isArray(content?.news) && content.news.length > 0
    ? content.news
    : DEFAULT_CONTENT.news;
  merged.news = rawNews.map((item, i) => {
    const base = item.id ? item : { id: "legacy-" + i, ...item };
    return {
      body: "",
      cover: "",
      ...base,
      link: base.link || `/news/${base.id || "legacy-" + i}`,
    };
  });

  // Vacancies: separate top-level array, always an array
  merged.vacancies = Array.isArray(content?.vacancies) ? content.vacancies : (DEFAULT_CONTENT.vacancies ?? []);
  merged.vacanciesApplyUrl =
    typeof content?.vacanciesApplyUrl === "string" && content.vacanciesApplyUrl.trim()
      ? content.vacanciesApplyUrl.trim()
      : DEFAULT_CONTENT.vacanciesApplyUrl;
  merged.productsServicesDocuments = Array.isArray(content?.productsServicesDocuments)
    ? content.productsServicesDocuments
    : [];
  merged.disclosureDocuments = Array.isArray(content?.disclosureDocuments)
    ? content.disclosureDocuments
    : [];

  return merged;
}

function ensureDataFiles() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  if (!fs.existsSync(CONTENT_FILE))
    fs.writeFileSync(CONTENT_FILE, JSON.stringify(DEFAULT_CONTENT, null, 2), "utf-8");
  if (!fs.existsSync(FILES_FILE))
    fs.writeFileSync(FILES_FILE, JSON.stringify([], null, 2), "utf-8");
}

function readJson(filePath, fallbackValue) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return fallbackValue;
  }
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf-8");
}

ensureDataFiles();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true, limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(UPLOADS_DIR));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "teplocentral-session-secret",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 8 },
  })
);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const uniquePrefix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniquePrefix}-${file.originalname}`);
  },
});

const upload = multer({ storage });

function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.redirect("/admin/login");
}

function getSectionsInOrder(content) {
  return SECTION_KEYS.map((key) => ({
    key,
    title: content.sections[key]?.title || key,
    image: content.sections[key]?.image || "",
    content: content.sections[key]?.content || "",
    route: SECTION_ROUTE_MAP[key],
  }));
}

// ─── PUBLIC ROUTES ───────────────────────────────────────────────────────────

app.get("/", (_req, res) => {
  const content = normalizeContentShape(readJson(CONTENT_FILE, DEFAULT_CONTENT));
  const files = readJson(FILES_FILE, []);
  res.render("index", {
    siteTitle: content.siteTitle,
    heroTitle: content.heroTitle,
    heroSubtitle: content.heroSubtitle,
    emergencyContacts: content.emergencyContacts,
    news: content.news,
    sections: getSectionsInOrder(content),
    files,
  });
});

app.get("/section/:key", (_req, res) => res.redirect("/"));

app.get("/news/:id", (_req, res) => {
  const content = normalizeContentShape(readJson(CONTENT_FILE, DEFAULT_CONTENT));
  const article = content.news.find((n) => n.id === _req.params.id);
  if (!article) return res.redirect("/");
  res.render("article", {
    siteTitle: content.siteTitle,
    sections: getSectionsInOrder(content),
    article,
  });
});

for (const key of SECTION_KEYS) {
  const route = SECTION_ROUTE_MAP[key];
  app.get(route, (_req, res) => {
    const content = normalizeContentShape(readJson(CONTENT_FILE, DEFAULT_CONTENT));
    const sections = getSectionsInOrder(content);
    const section = sections.find((item) => item.key === key);
    if (!section) return res.redirect("/");
    return res.render("section", {
      siteTitle: content.siteTitle,
      section,
      sections,
      vacancies: key === "vacancies" ? content.vacancies : [],
      vacanciesApplyUrl: content.vacanciesApplyUrl,
      sectionDocuments:
        key === "products_services"
          ? content.productsServicesDocuments
          : key === "disclosure"
            ? content.disclosureDocuments
            : [],
    });
  });
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────

app.get("/admin/login", (req, res) => {
  if (req.session?.isAdmin) return res.redirect("/admin");
  return res.render("admin-login", { error: null });
});

app.post("/admin/login", (req, res) => {
  const { username, password } = req.body;
  const adminUser = process.env.ADMIN_USER || "admin";
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
  if (username === adminUser && password === adminPassword) {
    req.session.isAdmin = true;
    return res.redirect("/admin");
  }
  return res.status(401).render("admin-login", { error: "Неверный логин или пароль" });
});

app.post("/admin/logout", requireAdmin, (req, res) => {
  req.session.destroy(() => res.redirect("/admin/login"));
});

// ─── ADMIN: DASHBOARD ─────────────────────────────────────────────────────────

app.get("/admin", requireAdmin, (_req, res) => {
  const content = normalizeContentShape(readJson(CONTENT_FILE, DEFAULT_CONTENT));
  const files = readJson(FILES_FILE, []);
  res.render("admin", {
    content,
    sections: getSectionsInOrder(content),
    files,
    vacancies: content.vacancies ?? [],
    productsServicesDocuments: content.productsServicesDocuments ?? [],
    disclosureDocuments: content.disclosureDocuments ?? [],
  });
});

// ─── ADMIN: GENERAL SETTINGS ──────────────────────────────────────────────────

app.post("/admin/content/general", requireAdmin, (req, res) => {
  const content = normalizeContentShape(readJson(CONTENT_FILE, DEFAULT_CONTENT));

  content.siteTitle = req.body.siteTitle?.trim() || content.siteTitle;
  content.heroTitle = req.body.heroTitle?.trim() || content.heroTitle;
  content.heroSubtitle = req.body.heroSubtitle?.trim() || content.heroSubtitle;
  content.emergencyContacts = content.emergencyContacts.map((item, i) => ({
    label: req.body[`emergency_${i}_label`]?.trim() || item.label,
    value: req.body[`emergency_${i}_value`]?.trim() || item.value,
  }));

  writeJson(CONTENT_FILE, content);
  res.redirect("/admin#tab-general");
});

// ─── ADMIN: SECTIONS ──────────────────────────────────────────────────────────

app.post("/admin/content/sections", requireAdmin, (req, res) => {
  const content = normalizeContentShape(readJson(CONTENT_FILE, DEFAULT_CONTENT));

  for (const key of SECTION_KEYS) {
    content.sections[key] = {
      title: req.body[`${key}_title`]?.trim() || content.sections[key].title,
      image: content.sections[key]?.image || "",
      content: req.body[`${key}_content`] ?? content.sections[key].content,
    };
  }

  writeJson(CONTENT_FILE, content);
  res.redirect("/admin#tab-sections");
});

app.post("/admin/content/section/:key", requireAdmin, upload.single("sectionImage"), (req, res) => {
  const key = req.params.key;
  if (!SECTION_KEYS.includes(key)) return res.redirect("/admin#tab-sections");

  const content = normalizeContentShape(readJson(CONTENT_FILE, DEFAULT_CONTENT));
  const currentSection = content.sections[key] || DEFAULT_CONTENT.sections[key];

  content.sections[key] = {
    ...currentSection,
    title: req.body.title?.trim() || currentSection.title,
    content: req.body.content ?? currentSection.content,
    image: req.file ? `/uploads/${req.file.filename}` : (currentSection.image || ""),
  };

  writeJson(CONTENT_FILE, content);
  res.redirect("/admin#tab-sections");
});

// ─── ADMIN: NEWS IMAGE UPLOAD (for Quill inline images) ──────────────────────

app.post("/admin/news/image", requireAdmin, upload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "no file" });
  res.json({ url: `/uploads/${req.file.filename}` });
});

// ─── ADMIN: NEWS CRUD ─────────────────────────────────────────────────────────

app.post("/admin/news/add", requireAdmin, upload.single("cover"), (req, res) => {
  const content = normalizeContentShape(readJson(CONTENT_FILE, DEFAULT_CONTENT));
  const id = String(Date.now());
  content.news.unshift({
    id,
    title: req.body.title?.trim() || "Без заголовка",
    excerpt: req.body.excerpt?.trim() || "",
    body: req.body.body || "",
    cover: req.file ? `/uploads/${req.file.filename}` : "",
    date: req.body.date?.trim() || new Date().toLocaleDateString("ru-RU"),
    link: `/news/${id}`,
  });
  writeJson(CONTENT_FILE, content);
  res.redirect("/admin#tab-news");
});

app.post("/admin/news/edit/:id", requireAdmin, upload.single("cover"), (req, res) => {
  const content = normalizeContentShape(readJson(CONTENT_FILE, DEFAULT_CONTENT));
  content.news = content.news.map((item) => {
    if (item.id !== req.params.id) return item;
    return {
      ...item,
      title: req.body.title?.trim() || item.title,
      excerpt: req.body.excerpt?.trim() || item.excerpt,
      body: req.body.body ?? item.body,
      cover: req.file ? `/uploads/${req.file.filename}` : item.cover,
      date: req.body.date?.trim() || item.date,
    };
  });
  writeJson(CONTENT_FILE, content);
  res.redirect("/admin#tab-news");
});

app.post("/admin/news/delete/:id", requireAdmin, (req, res) => {
  const content = normalizeContentShape(readJson(CONTENT_FILE, DEFAULT_CONTENT));
  content.news = content.news.filter((item) => item.id !== req.params.id);
  writeJson(CONTENT_FILE, content);
  res.redirect("/admin#tab-news");
});

// ─── ADMIN: VACANCIES CRUD ────────────────────────────────────────────────────

app.post("/admin/vacancies/add", requireAdmin, (req, res) => {
  const content = normalizeContentShape(readJson(CONTENT_FILE, DEFAULT_CONTENT));
  content.vacancies.unshift({
    id: String(Date.now()),
    title: req.body.title?.trim() || "Без названия",
    department: req.body.department?.trim() || "",
    salary: req.body.salary?.trim() || "",
    requirements: req.body.requirements?.trim() || "",
    conditions: req.body.conditions?.trim() || "",
    contact: req.body.contact?.trim() || "",
    url: req.body.url?.trim() || "",
  });
  writeJson(CONTENT_FILE, content);
  res.redirect("/admin#tab-vacancies");
});

app.post("/admin/vacancies/edit/:id", requireAdmin, (req, res) => {
  const content = normalizeContentShape(readJson(CONTENT_FILE, DEFAULT_CONTENT));
  content.vacancies = content.vacancies.map((v) => {
    if (v.id !== req.params.id) return v;
    return {
      ...v,
      title: req.body.title?.trim() || v.title,
      department: req.body.department?.trim() ?? v.department,
      salary: req.body.salary?.trim() ?? v.salary,
      requirements: req.body.requirements?.trim() ?? v.requirements,
      conditions: req.body.conditions?.trim() ?? v.conditions,
      contact: req.body.contact?.trim() ?? v.contact,
      url: req.body.url?.trim() ?? v.url ?? "",
    };
  });
  writeJson(CONTENT_FILE, content);
  res.redirect("/admin#tab-vacancies");
});

app.post("/admin/vacancies/delete/:id", requireAdmin, (req, res) => {
  const content = normalizeContentShape(readJson(CONTENT_FILE, DEFAULT_CONTENT));
  content.vacancies = content.vacancies.filter((v) => v.id !== req.params.id);
  writeJson(CONTENT_FILE, content);
  res.redirect("/admin#tab-vacancies");
});

app.post("/admin/vacancies/settings", requireAdmin, (req, res) => {
  const content = normalizeContentShape(readJson(CONTENT_FILE, DEFAULT_CONTENT));
  content.vacanciesApplyUrl = req.body.vacanciesApplyUrl?.trim() || content.vacanciesApplyUrl;
  writeJson(CONTENT_FILE, content);
  res.redirect("/admin#tab-vacancies");
});

function addSectionDocument(content, sectionType, req) {
  const listKey = sectionType === "disclosure" ? "disclosureDocuments" : "productsServicesDocuments";
  const uploaded = req.file;
  if (!uploaded) return;
  const targetList = Array.isArray(content[listKey]) ? content[listKey] : [];
  targetList.unshift({
    id: String(Date.now()),
    title: req.body.title?.trim() || uploaded.originalname,
    description: req.body.description?.trim() || "",
    originalName: uploaded.originalname,
    fileName: uploaded.filename,
    url: `/uploads/${uploaded.filename}`,
    uploadedAt: new Date().toISOString(),
  });
  content[listKey] = targetList;
}

app.post("/admin/section-documents/add", requireAdmin, upload.single("document"), (req, res) => {
  const sectionType = req.body.sectionType;
  if (!["products_services", "disclosure"].includes(sectionType)) {
    return res.redirect("/admin#tab-sections");
  }

  const content = normalizeContentShape(readJson(CONTENT_FILE, DEFAULT_CONTENT));
  addSectionDocument(content, sectionType, req);
  writeJson(CONTENT_FILE, content);
  res.redirect("/admin#tab-sections");
});

app.post("/admin/section-documents/delete/:id", requireAdmin, (req, res) => {
  const sectionType = req.body.sectionType;
  if (!["products_services", "disclosure"].includes(sectionType)) {
    return res.redirect("/admin#tab-sections");
  }
  const listKey = sectionType === "disclosure" ? "disclosureDocuments" : "productsServicesDocuments";
  const content = normalizeContentShape(readJson(CONTENT_FILE, DEFAULT_CONTENT));
  const targetList = Array.isArray(content[listKey]) ? content[listKey] : [];
  const target = targetList.find((item) => item.id === req.params.id);
  if (target) {
    const filePath = path.join(UPLOADS_DIR, target.fileName);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  content[listKey] = targetList.filter((item) => item.id !== req.params.id);
  writeJson(CONTENT_FILE, content);
  res.redirect("/admin#tab-sections");
});

// ─── ADMIN: FILES ─────────────────────────────────────────────────────────────

app.post("/admin/files/upload", requireAdmin, upload.single("document"), (req, res) => {
  if (!req.file) return res.redirect("/admin#tab-files");
  const files = readJson(FILES_FILE, []);
  files.unshift({
    id: String(Date.now()),
    title: req.body.title?.trim() || req.file.originalname,
    originalName: req.file.originalname,
    fileName: req.file.filename,
    url: `/uploads/${req.file.filename}`,
    uploadedAt: new Date().toISOString(),
  });
  writeJson(FILES_FILE, files);
  res.redirect("/admin#tab-files");
});

app.post("/admin/files/delete/:id", requireAdmin, (req, res) => {
  const files = readJson(FILES_FILE, []);
  const target = files.find((f) => f.id === req.params.id);
  if (target) {
    const filePath = path.join(UPLOADS_DIR, target.fileName);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  writeJson(FILES_FILE, files.filter((f) => f.id !== req.params.id));
  res.redirect("/admin#tab-files");
});

// ─── START ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Teplocentral started on http://localhost:${PORT}`);
});
