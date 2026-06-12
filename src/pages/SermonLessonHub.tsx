import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlignLeft,
  Archive,
  Bold,
  BookOpen,
  CalendarDays,
  Check,
  Download,
  FileText,
  Heading1,
  Heading2,
  Highlighter,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Mic2,
  Pencil,
  Plus,
  Printer,
  Search,
  Trash2,
  Users,
  Youtube,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type HubItemType = "sermon" | "lesson";
type HubItemStatus = "idea" | "drafting" | "ready" | "delivered" | "archived";
type ReferenceType = "commentary" | "sermon" | "book" | "article" | "other";
type MediaType = "image" | "youtube" | "link";
type HubView = "write" | "resources" | "library";

type HubReference = {
  id: string;
  type: ReferenceType;
  title: string;
  author: string;
  url: string;
  notes: string;
};

type HubMedia = {
  id: string;
  type: MediaType;
  title: string;
  url: string;
};

type HubItem = {
  id: string;
  type: HubItemType;
  title: string;
  series: string;
  scripture: string;
  speaker: string;
  audience: string;
  scheduledDate: string;
  status: HubItemStatus;
  summary: string;
  contentHtml: string;
  references: HubReference[];
  media: HubMedia[];
  keyTakeaway: string;
  updatedAt: string;
};

type HubForm = Omit<HubItem, "id" | "updatedAt">;

const STORAGE_KEY = "actsix-sermon-lesson-hub-items";

const statusLabels: Record<HubItemStatus, string> = {
  idea: "Idea",
  drafting: "Drafting",
  ready: "Ready",
  delivered: "Delivered",
  archived: "Archived",
};

const statusStyles: Record<HubItemStatus, string> = {
  idea: "border-brand-sand/60 bg-brand-sand/20 text-brand-charcoal",
  drafting: "border-brand-warning/30 bg-brand-warning/10 text-brand-warning",
  ready: "border-brand-teal/25 bg-brand-teal/10 text-brand-teal",
  delivered: "border-brand-success/30 bg-brand-success/10 text-brand-success",
  archived: "border-border bg-muted text-muted-foreground",
};

const highlightColors = [
  { label: "Lemon", value: "#FFF4B8" },
  { label: "Mint", value: "#DDF7DF" },
  { label: "Sky", value: "#DCEEFF" },
  { label: "Lavender", value: "#EDE4FF" },
  { label: "Rose", value: "#FFE0E7" },
  { label: "Peach", value: "#FFE4C7" },
];

const sampleContent = `
  <h1>A people formed by hope</h1>
  <p><strong>Big idea:</strong> Christian hope gives the church emotional courage for ordinary faithfulness.</p>
  <h2>Opening</h2>
  <p>Define hope as a formed habit, not a passing mood.</p>
  <h2>Movement 1</h2>
  <p>Received mercy gives the church a new starting point.</p>
`;

const defaultItems: HubItem[] = [
  {
    id: "sample-sermon",
    type: "sermon",
    title: "A people formed by hope",
    series: "Living the Kingdom",
    scripture: "1 Peter 1:3-9",
    speaker: "Teaching Team",
    audience: "Sunday gathering",
    scheduledDate: "",
    status: "drafting",
    summary: "A sermon frame about hope as a formed habit, not a mood.",
    contentHtml: sampleContent,
    references: [
      {
        id: "sample-reference",
        type: "commentary",
        title: "1 Peter commentary notes",
        author: "Teaching library",
        url: "",
        notes: "Check historical context and exile language.",
      },
    ],
    media: [],
    keyTakeaway: "Christian hope gives the church emotional courage for ordinary faithfulness.",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "sample-lesson",
    type: "lesson",
    title: "How to read a passage in context",
    series: "Bible Basics",
    scripture: "Luke 10:25-37",
    speaker: "Discipleship Team",
    audience: "Small group leaders",
    scheduledDate: "",
    status: "ready",
    summary: "A practical lesson for observing genre, context, repetition, and application.",
    contentHtml:
      "<h1>How to read a passage in context</h1><p>Good interpretation starts before application.</p><h2>Practice</h2><p>Read Luke 10:25-37 and list repeated ideas, setting, and audience.</p>",
    references: [],
    media: [],
    keyTakeaway: "Good interpretation starts before application.",
    updatedAt: new Date().toISOString(),
  },
];

const emptyForm: HubForm = {
  type: "sermon",
  title: "",
  series: "",
  scripture: "",
  speaker: "",
  audience: "",
  scheduledDate: "",
  status: "idea",
  summary: "",
  contentHtml: "<h1>Untitled teaching item</h1><p>Start writing here...</p>",
  references: [],
  media: [],
  keyTakeaway: "",
};

const isArchivedStatus = (status: HubItemStatus) => status === "delivered" || status === "archived";

const stripHtml = (html: string) => {
  const element = document.createElement("div");
  element.innerHTML = html;
  return element.textContent || element.innerText || "";
};

const sanitizeHtml = (html: string) => {
  const template = document.createElement("template");
  template.innerHTML = html;

  template.content.querySelectorAll("script, style, iframe, object, embed").forEach((node) => node.remove());
  template.content.querySelectorAll<HTMLElement>("*").forEach((node) => {
    Array.from(node.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.toLowerCase();

      if (name.startsWith("on") || value.includes("javascript:")) {
        node.removeAttribute(attribute.name);
      }
    });
  });

  return template.innerHTML;
};

const normalizeItem = (item: Partial<HubItem> & { notes?: string }): HubItem => ({
  id: item.id || crypto.randomUUID(),
  type: item.type || "sermon",
  title: item.title || "",
  series: item.series || "",
  scripture: item.scripture || "",
  speaker: item.speaker || "",
  audience: item.audience || "",
  scheduledDate: item.scheduledDate || "",
  status: item.status || "idea",
  summary: item.summary || "",
  contentHtml: sanitizeHtml(item.contentHtml || (item.notes ? `<p>${item.notes}</p>` : "")),
  references: Array.isArray(item.references) ? item.references : [],
  media: Array.isArray(item.media) ? item.media : [],
  keyTakeaway: item.keyTakeaway || "",
  updatedAt: item.updatedAt || new Date().toISOString(),
});

const loadItems = (): HubItem[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) && parsed.length > 0 ? parsed.map(normalizeItem) : defaultItems;
  } catch {
    return defaultItems;
  }
};

const saveItems = (items: HubItem[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
};

const formatDate = (date: string) => {
  if (!date) return "Unscheduled";

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00`));
};

const getYoutubeEmbedUrl = (url: string) => {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?/]+)/i);
  return match?.[1] ? `https://www.youtube.com/embed/${match[1]}` : "";
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "teaching-item";

const buildExportHtml = (item: HubItem) => `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${item.title}</title>
    <style>
      body { font-family: Arial, sans-serif; color: #1E1E1B; line-height: 1.55; margin: 42px; }
      h1 { font-size: 30px; margin-bottom: 8px; }
      h2 { font-size: 20px; margin-top: 24px; }
      .meta { color: #555; font-size: 13px; margin-bottom: 22px; }
      .takeaway { background: #DDF7DF; border: 1px solid #B7E6BC; padding: 12px; margin: 18px 0; }
      img { max-width: 100%; height: auto; }
      a { color: #1F6868; }
      li { margin-bottom: 4px; }
      .section { margin-top: 24px; }
    </style>
  </head>
  <body>
    <h1>${item.title}</h1>
    <div class="meta">
      ${item.type.toUpperCase()} | ${item.series || "No series"} | ${item.scripture || "No scripture"} | ${formatDate(item.scheduledDate)}
      <br />${item.speaker || "No speaker"} | ${item.audience || "No audience"}
    </div>
    ${item.keyTakeaway ? `<div class="takeaway"><strong>Key takeaway:</strong> ${item.keyTakeaway}</div>` : ""}
    ${sanitizeHtml(item.contentHtml)}
    ${
      item.references.length
        ? `<div class="section"><h2>References</h2><ul>${item.references
            .map(
              (reference) =>
                `<li><strong>${reference.title || "Untitled reference"}</strong>${reference.author ? `, ${reference.author}` : ""}${
                  reference.url ? ` - <a href="${reference.url}">${reference.url}</a>` : ""
                }${reference.notes ? `<br />${reference.notes}` : ""}</li>`
            )
            .join("")}</ul></div>`
        : ""
    }
    ${
      item.media.length
        ? `<div class="section"><h2>Media</h2><ul>${item.media
            .map((media) => `<li><strong>${media.title || media.type}</strong>${media.url ? ` - ${media.url}` : ""}</li>`)
            .join("")}</ul></div>`
        : ""
    }
  </body>
</html>`;

export default function SermonLessonHub() {
  const [items, setItems] = useState<HubItem[]>(loadItems);
  const [form, setForm] = useState<HubForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [archiveQuery, setArchiveQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | HubItemType>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | HubItemStatus>("all");
  const [archiveStatusFilter, setArchiveStatusFilter] = useState<"all" | HubItemStatus>("all");
  const [activeView, setActiveView] = useState<HubView>("write");
  const editorRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== form.contentHtml) {
      editorRef.current.innerHTML = form.contentHtml;
    }
  }, [editingId, form.contentHtml]);

  const activeItems = useMemo(() => items.filter((item) => !isArchivedStatus(item.status)), [items]);
  const archivedItems = useMemo(() => items.filter((item) => isArchivedStatus(item.status)), [items]);

  const filteredItems = useMemo(
    () => filterItems(activeItems, query, typeFilter, statusFilter),
    [activeItems, query, statusFilter, typeFilter]
  );

  const filteredArchive = useMemo(
    () => filterItems(archivedItems, archiveQuery, typeFilter, archiveStatusFilter),
    [archiveQuery, archiveStatusFilter, archivedItems, typeFilter]
  );

  const stats = useMemo(
    () => ({
      sermons: items.filter((item) => item.type === "sermon").length,
      lessons: items.filter((item) => item.type === "lesson").length,
      ready: items.filter((item) => item.status === "ready").length,
      archived: archivedItems.length,
    }),
    [archivedItems.length, items]
  );

  const selectedItem = editingId ? items.find((item) => item.id === editingId) : null;

  const persistItems = (nextItems: HubItem[]) => {
    setItems(nextItems);
    saveItems(nextItems);
  };

  const updateContent = () => {
    setForm((current) => ({
      ...current,
      contentHtml: sanitizeHtml(editorRef.current?.innerHTML || ""),
    }));
  };

  const applyCommand = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    updateContent();
  };

  const applyBlock = (tag: "h1" | "h2" | "p") => {
    applyCommand("formatBlock", tag);
  };

  const insertLink = () => {
    const url = window.prompt("Paste a link");
    if (!url) return;
    applyCommand("createLink", url);
  };

  const insertImageUrl = () => {
    const url = window.prompt("Paste an image URL");
    if (!url) return;
    applyCommand("insertImage", url);
    setForm((current) => ({
      ...current,
      media: [
        ...current.media,
        {
          id: crypto.randomUUID(),
          type: "image",
          title: "Sermon image",
          url,
        },
      ],
    }));
  };

  const uploadImage = (file?: File) => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      applyCommand("insertImage", result);
      setForm((current) => ({
        ...current,
        media: [
          ...current.media,
          {
            id: crypto.randomUUID(),
            type: "image",
            title: file.name,
            url: result,
          },
        ],
      }));
    };
    reader.readAsDataURL(file);
  };

  const addReference = () => {
    setForm((current) => ({
      ...current,
      references: [
        ...current.references,
        {
          id: crypto.randomUUID(),
          type: "commentary",
          title: "",
          author: "",
          url: "",
          notes: "",
        },
      ],
    }));
  };

  const addMedia = (type: MediaType) => {
    setForm((current) => ({
      ...current,
      media: [
        ...current.media,
        {
          id: crypto.randomUUID(),
          type,
          title: "",
          url: "",
        },
      ],
    }));
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const submitItem = () => {
    updateContent();

    if (!form.title.trim()) {
      toast.error("Add a title first.");
      return;
    }

    const now = new Date().toISOString();
    const cleanedForm = {
      ...form,
      title: form.title.trim(),
      contentHtml: sanitizeHtml(editorRef.current?.innerHTML || form.contentHtml),
      references: form.references.filter((reference) => reference.title || reference.url || reference.notes),
      media: form.media.filter((media) => media.url || media.title),
    };

    if (editingId) {
      persistItems(
        items.map((item) =>
          item.id === editingId
            ? {
                ...item,
                ...cleanedForm,
                updatedAt: now,
              }
            : item
        )
      );
      toast.success("Teaching item updated");
      return;
    }

    const nextItem = {
      ...cleanedForm,
      id: crypto.randomUUID(),
      updatedAt: now,
    };
    persistItems([nextItem, ...items]);
    setEditingId(nextItem.id);
    setActiveView("write");
    toast.success(`${form.type === "sermon" ? "Sermon" : "Lesson"} added`);
  };

  const editItem = (item: HubItem) => {
    const { id, updatedAt, ...nextForm } = item;
    setForm(nextForm);
    setEditingId(id);
    setActiveView("write");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteItem = (itemId: string) => {
    persistItems(items.filter((item) => item.id !== itemId));
    if (editingId === itemId) resetForm();
    toast.success("Removed from hub");
  };

  const setItemStatus = (itemId: string, status: HubItemStatus) => {
    persistItems(
      items.map((item) =>
        item.id === itemId
          ? { ...item, status, updatedAt: new Date().toISOString() }
          : item
      )
    );
  };

  const exportWord = (item = selectedItem) => {
    if (!item) {
      toast.error("Save or select a teaching item first.");
      return;
    }

    const html = buildExportHtml(item);
    downloadBlob(new Blob(["\ufeff", html], { type: "application/msword" }), `${slugify(item.title)}.doc`);
  };

  const exportPdf = (item = selectedItem) => {
    if (!item) {
      toast.error("Save or select a teaching item first.");
      return;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Allow popups to export PDF.");
      return;
    }

    printWindow.document.write(buildExportHtml(item));
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <div className="min-w-0">
      <PageHeader
        eyebrow="Sermon / Lesson Hub"
        title="Sermon Hub"
        subtitle="A quiet place to write, gather sources, and reuse previous teaching."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" className="actsix-btn-primary rounded-xl" onClick={resetForm}>
              <Plus className="h-4 w-4" />
              New item
            </Button>
          </div>
        }
      />

      <div className="px-4 pb-4 sm:px-6 xl:px-8 2xl:px-10">
        <HubViewTabs activeView={activeView} onChange={setActiveView} />
      </div>

      <div className="grid gap-4 px-4 pb-8 sm:px-6 xl:grid-cols-[minmax(0,1fr)_20rem] xl:px-8 2xl:px-10">
        <div className="space-y-4">
          <section className={cn("grid gap-3 sm:grid-cols-2 xl:grid-cols-4", activeView !== "library" && "hidden")}>
            <StatTile icon={Mic2} label="Sermons" value={stats.sermons} />
            <StatTile icon={BookOpen} label="Lessons" value={stats.lessons} />
            <StatTile icon={Check} label="Ready" value={stats.ready} />
            <StatTile icon={Archive} label="Archive" value={stats.archived} />
          </section>

          <section className={cn("actsix-panel overflow-hidden", activeView !== "write" && "hidden")}>
            <div className="border-b border-border/70 p-4 sm:p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="label-eyebrow">Composer</p>
                  <h2 className="mt-1 text-xl font-extrabold">
                    {editingId ? "Edit sermon or lesson" : "Write a sermon or lesson"}
                  </h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    data-testid="sermon-hub-save"
                    className="actsix-btn-primary h-10 rounded-xl"
                    onClick={submitItem}
                  >
                    {editingId ? "Save changes" : "Save item"}
                  </Button>
                  {editingId && (
                    <Button type="button" variant="outline" className="actsix-btn-outline h-10 rounded-xl" onClick={resetForm}>
                      Clear
                    </Button>
                  )}
                </div>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-4">
                <SegmentedType value={form.type} onChange={(type) => setForm((current) => ({ ...current, type }))} />
                <Input
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Title"
                  className="h-10 rounded-[var(--radius-control)] border-border/70 bg-background lg:col-span-2"
                />
                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, status: event.target.value as HubItemStatus }))
                  }
                  className="h-10 rounded-[var(--radius-control)] border border-border/70 bg-background px-3 text-sm font-bold text-foreground outline-none focus:ring-2 focus:ring-brand-teal/25"
                >
                  <option value="idea">Idea</option>
                  <option value="drafting">Drafting</option>
                  <option value="ready">Ready</option>
                  <option value="delivered">Delivered</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Input
                  value={form.series}
                  onChange={(event) => setForm((current) => ({ ...current, series: event.target.value }))}
                  placeholder="Series"
                  className="h-10 rounded-[var(--radius-control)] border-border/70 bg-background"
                />
                <Input
                  value={form.scripture}
                  onChange={(event) => setForm((current) => ({ ...current, scripture: event.target.value }))}
                  placeholder="Scripture"
                  className="h-10 rounded-[var(--radius-control)] border-border/70 bg-background"
                />
                <Input
                  value={form.speaker}
                  onChange={(event) => setForm((current) => ({ ...current, speaker: event.target.value }))}
                  placeholder="Speaker"
                  className="h-10 rounded-[var(--radius-control)] border-border/70 bg-background"
                />
                <Input
                  type="date"
                  value={form.scheduledDate}
                  onChange={(event) => setForm((current) => ({ ...current, scheduledDate: event.target.value }))}
                  className="h-10 rounded-[var(--radius-control)] border-border/70 bg-background"
                />
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                <Input
                  value={form.audience}
                  onChange={(event) => setForm((current) => ({ ...current, audience: event.target.value }))}
                  placeholder="Audience"
                  className="h-10 rounded-[var(--radius-control)] border-border/70 bg-background"
                />
                <Input
                  value={form.keyTakeaway}
                  onChange={(event) => setForm((current) => ({ ...current, keyTakeaway: event.target.value }))}
                  placeholder="Key takeaway"
                  className="h-10 rounded-[var(--radius-control)] border-border/70 bg-background"
                />
              </div>

              <Textarea
                value={form.summary}
                onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))}
                placeholder="Short summary"
                className="mt-3 min-h-[68px] resize-none rounded-[var(--radius-control)] border-border/70 bg-background"
              />
            </div>

            <EditorToolbar
              onCommand={applyCommand}
              onBlock={applyBlock}
              onLink={insertLink}
              onImageUrl={insertImageUrl}
              onImageUpload={() => imageInputRef.current?.click()}
            />
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                uploadImage(event.target.files?.[0]);
                event.target.value = "";
              }}
            />

            <div className="bg-white px-4 pb-5 sm:px-5">
              <div
                ref={editorRef}
                data-testid="sermon-hub-editor"
                contentEditable
                suppressContentEditableWarning
                onInput={updateContent}
                onBlur={updateContent}
                className="min-h-[28rem] rounded-xl border border-border/70 bg-white px-5 py-4 text-[15px] leading-7 text-foreground shadow-inner outline-none focus:ring-4 focus:ring-brand-teal/15 [&_a]:font-semibold [&_a]:text-brand-teal [&_h1]:mb-4 [&_h1]:mt-2 [&_h1]:text-3xl [&_h1]:font-extrabold [&_h2]:mb-3 [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-extrabold [&_img]:my-4 [&_img]:rounded-xl [&_img]:border [&_img]:border-border/70 [&_li]:my-1 [&_ol]:ml-6 [&_p]:my-3 [&_ul]:ml-6"
              />
            </div>
          </section>

          <section className={cn("actsix-panel p-4 sm:p-5", activeView !== "resources" && "hidden")} data-testid="sermon-hub-references">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="label-eyebrow">References</p>
                <h2 className="mt-1 text-xl font-extrabold">Sources, commentaries, sermons, and notes</h2>
              </div>
              <Button type="button" variant="outline" className="actsix-btn-outline rounded-xl" onClick={addReference}>
                <Plus className="h-4 w-4" />
                Add reference
              </Button>
            </div>

            <div className="mt-4 space-y-3">
              {form.references.length === 0 ? (
                <p className="actsix-empty-state">
                  Add commentaries, books, articles, or other sermons you want attached to this teaching item.
                </p>
              ) : (
                form.references.map((reference) => (
                  <ReferenceEditor
                    key={reference.id}
                    reference={reference}
                    onChange={(updates) =>
                      setForm((current) => ({
                        ...current,
                        references: current.references.map((item) =>
                          item.id === reference.id ? { ...item, ...updates } : item
                        ),
                      }))
                    }
                    onRemove={() =>
                      setForm((current) => ({
                        ...current,
                        references: current.references.filter((item) => item.id !== reference.id),
                      }))
                    }
                  />
                ))
              )}
            </div>
          </section>

          <section className={cn("actsix-panel p-4 sm:p-5", activeView !== "resources" && "hidden")} data-testid="sermon-hub-media">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="label-eyebrow">Media</p>
                <h2 className="mt-1 text-xl font-extrabold">Images and sermon links</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" className="actsix-btn-outline rounded-xl" onClick={() => addMedia("youtube")}>
                  <Youtube className="h-4 w-4" />
                  YouTube
                </Button>
                <Button type="button" variant="outline" className="actsix-btn-outline rounded-xl" onClick={() => addMedia("image")}>
                  <ImageIcon className="h-4 w-4" />
                  Image URL
                </Button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {form.media.length === 0 ? (
                <p className="actsix-empty-state lg:col-span-2">
                  Attach YouTube sermons, image links, or reference media. Uploaded images from the editor are tracked here too.
                </p>
              ) : (
                form.media.map((media) => (
                  <MediaEditor
                    key={media.id}
                    media={media}
                    onChange={(updates) =>
                      setForm((current) => ({
                        ...current,
                        media: current.media.map((item) => (item.id === media.id ? { ...item, ...updates } : item)),
                      }))
                    }
                    onRemove={() =>
                      setForm((current) => ({
                        ...current,
                        media: current.media.filter((item) => item.id !== media.id),
                      }))
                    }
                  />
                ))
              )}
            </div>
          </section>

          {activeView === "library" && (
            <>
              <LibrarySection
                title="Active Prep"
                items={filteredItems}
                query={query}
                onQueryChange={setQuery}
                typeFilter={typeFilter}
                onTypeFilterChange={setTypeFilter}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
                onEdit={editItem}
                onDelete={deleteItem}
                onArchive={(item) => setItemStatus(item.id, "archived")}
                onExportPdf={exportPdf}
                onExportWord={exportWord}
              />

              <LibrarySection
                title="Archive"
                items={filteredArchive}
                query={archiveQuery}
                onQueryChange={setArchiveQuery}
                typeFilter={typeFilter}
                onTypeFilterChange={setTypeFilter}
                statusFilter={archiveStatusFilter}
                onStatusFilterChange={setArchiveStatusFilter}
                archive
                onEdit={editItem}
                onDelete={deleteItem}
                onArchive={(item) => setItemStatus(item.id, "drafting")}
                onExportPdf={exportPdf}
                onExportWord={exportWord}
              />
            </>
          )}
        </div>

        <aside className="space-y-4">
          <section className="actsix-panel-soft p-4">
            <p className="label-eyebrow">Current Draft</p>
            <h2 className="mt-2 text-xl font-extrabold leading-tight">
              {form.title || "Untitled teaching item"}
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="outline" className={cn("rounded-full text-[11px] font-extrabold", statusStyles[form.status])}>
                {statusLabels[form.status]}
              </Badge>
              <Badge variant="outline" className="rounded-full border-brand-teal/20 bg-brand-teal/10 text-[11px] font-extrabold uppercase text-brand-teal">
                {form.type}
              </Badge>
            </div>
            <div className="mt-4 space-y-2 text-sm font-semibold text-muted-foreground">
              <p className="flex gap-2">
                <FileText className="mt-0.5 h-4 w-4 shrink-0" />
                {form.scripture || "No scripture set"}
              </p>
              <p className="flex gap-2">
                <Users className="mt-0.5 h-4 w-4 shrink-0" />
                {form.audience || "No audience set"}
              </p>
              <p className="flex gap-2">
                <CalendarDays className="mt-0.5 h-4 w-4 shrink-0" />
                {formatDate(form.scheduledDate)}
              </p>
            </div>
            {form.keyTakeaway && (
              <div className="mt-4 rounded-xl border border-brand-teal/15 bg-brand-teal/5 p-3 text-sm font-semibold">
                {form.keyTakeaway}
              </div>
            )}
          </section>

          <section className="actsix-panel-soft p-4">
            <p className="label-eyebrow">Export</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
            <Button
              type="button"
              data-testid="sermon-hub-export-pdf"
              variant="outline"
              className="actsix-btn-outline rounded-xl"
              onClick={() => exportPdf()}
            >
                <Printer className="h-4 w-4" />
                PDF
              </Button>
            <Button
              type="button"
              data-testid="sermon-hub-export-word"
              variant="outline"
              className="actsix-btn-outline rounded-xl"
              onClick={() => exportWord()}
            >
                <Download className="h-4 w-4" />
                Word
              </Button>
            </div>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              Save the item first, then export. PDF opens the print dialog so it can be saved as PDF.
            </p>
          </section>

          <section className={cn("actsix-panel-soft p-4", activeView !== "library" && "hidden")}>
            <p className="label-eyebrow">Search Coverage</p>
            <div className="mt-3 space-y-2 text-sm font-semibold text-muted-foreground">
              <p>{items.length} total teaching items</p>
              <p>{activeItems.length} active drafts and ready items</p>
              <p>{archivedItems.length} delivered or archived items</p>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

const HubViewTabs = ({
  activeView,
  onChange,
}: {
  activeView: HubView;
  onChange: (view: HubView) => void;
}) => {
  const views: Array<{ key: HubView; label: string; icon: typeof Pencil }> = [
    {
      key: "write",
      label: "Write",
      icon: Pencil,
    },
    {
      key: "resources",
      label: "Resources",
      icon: BookOpen,
    },
    {
      key: "library",
      label: "Library",
      icon: Archive,
    },
  ];

  return (
    <div className="actsix-filter-pills">
      {views.map((view) => {
        const Icon = view.icon;
        const active = activeView === view.key;

        return (
          <button
            key={view.key}
            type="button"
            className={cn(
              "actsix-filter-pill",
              active
                ? "border-brand-teal/35 bg-brand-teal/10 text-brand-teal"
                : "border-border/70 bg-card/70 text-muted-foreground hover:border-brand-teal/25 hover:bg-brand-teal/5 hover:text-brand-teal"
            )}
            data-state={active ? "active" : "inactive"}
            onClick={() => onChange(view.key)}
          >
            <Icon className="h-3.5 w-3.5" />
            {view.label}
          </button>
        );
      })}
    </div>
  );
};

const filterItems = (
  items: HubItem[],
  query: string,
  typeFilter: "all" | HubItemType,
  statusFilter: "all" | HubItemStatus
) => {
  const normalizedQuery = query.trim().toLowerCase();

  return items.filter((item) => {
    const matchesQuery =
      !normalizedQuery ||
      [
        item.title,
        item.series,
        item.scripture,
        item.speaker,
        item.audience,
        item.summary,
        item.keyTakeaway,
        stripHtml(item.contentHtml),
        ...item.references.flatMap((reference) => [reference.title, reference.author, reference.url, reference.notes]),
        ...item.media.flatMap((media) => [media.title, media.url]),
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);

    const matchesType = typeFilter === "all" || item.type === typeFilter;
    const matchesStatus = statusFilter === "all" || item.status === statusFilter;

    return matchesQuery && matchesType && matchesStatus;
  });
};

const EditorToolbar = ({
  onCommand,
  onBlock,
  onLink,
  onImageUrl,
  onImageUpload,
}: {
  onCommand: (command: string, value?: string) => void;
  onBlock: (tag: "h1" | "h2" | "p") => void;
  onLink: () => void;
  onImageUrl: () => void;
  onImageUpload: () => void;
}) => (
  <div
    data-testid="sermon-hub-toolbar"
    className="flex flex-wrap items-center gap-2 border-b border-border/70 bg-muted/30 px-4 py-3 sm:px-5"
  >
    <ToolbarButton label="H1" icon={Heading1} onClick={() => onBlock("h1")} />
    <ToolbarButton label="H2" icon={Heading2} onClick={() => onBlock("h2")} />
    <ToolbarButton label="Body" icon={AlignLeft} onClick={() => onBlock("p")} />
    <span className="mx-1 h-8 w-px bg-border" />
    <ToolbarButton label="Bold" icon={Bold} onClick={() => onCommand("bold")} />
    <ToolbarButton label="Italic" icon={Italic} onClick={() => onCommand("italic")} />
    <ToolbarButton label="Bullets" icon={List} onClick={() => onCommand("insertUnorderedList")} />
    <ToolbarButton label="Numbers" icon={ListOrdered} onClick={() => onCommand("insertOrderedList")} />
    <ToolbarButton label="Link" icon={LinkIcon} onClick={onLink} />
    <ToolbarButton label="Image URL" icon={ImageIcon} onClick={onImageUrl} />
    <ToolbarButton label="Upload image" icon={Plus} onClick={onImageUpload} />
    <span className="mx-1 h-8 w-px bg-border" />
    <div className="flex items-center gap-1 rounded-xl border border-border/70 bg-background px-2 py-1">
      <Highlighter className="h-4 w-4 text-muted-foreground" />
      {highlightColors.map((color) => (
        <button
          key={color.value}
          type="button"
          className="h-6 w-6 rounded-full border border-border/80 transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/30"
          style={{ backgroundColor: color.value }}
          title={`Highlight ${color.label}`}
          aria-label={`Highlight ${color.label}`}
          onClick={() => onCommand("hiliteColor", color.value)}
        />
      ))}
    </div>
  </div>
);

const ToolbarButton = ({
  label,
  icon: Icon,
  onClick,
}: {
  label: string;
  icon: typeof Bold;
  onClick: () => void;
}) => (
  <button
    type="button"
    onMouseDown={(event) => event.preventDefault()}
    onClick={onClick}
    className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border/70 bg-background px-2.5 text-xs font-extrabold text-muted-foreground transition hover:border-brand-teal/30 hover:bg-brand-teal/5 hover:text-brand-teal"
    title={label}
  >
    <Icon className="h-4 w-4" />
    <span className="hidden sm:inline">{label}</span>
  </button>
);

const SegmentedType = ({
  value,
  onChange,
}: {
  value: HubItemType;
  onChange: (type: HubItemType) => void;
}) => (
  <div className="grid grid-cols-2 gap-2">
    {(["sermon", "lesson"] as HubItemType[]).map((type) => (
      <button
        key={type}
        type="button"
        onClick={() => onChange(type)}
        className={cn(
          "h-10 rounded-[var(--radius-control)] border px-3 text-sm font-extrabold transition",
          value === type
            ? "border-brand-teal bg-brand-teal text-white"
            : "border-border/70 bg-background text-muted-foreground hover:border-brand-teal/30 hover:bg-brand-teal/5 hover:text-brand-teal"
        )}
      >
        {type === "sermon" ? "Sermon" : "Lesson"}
      </button>
    ))}
  </div>
);

const ReferenceEditor = ({
  reference,
  onChange,
  onRemove,
}: {
  reference: HubReference;
  onChange: (updates: Partial<HubReference>) => void;
  onRemove: () => void;
}) => (
  <Card className="actsix-panel-soft p-3">
    <div className="grid gap-2 md:grid-cols-[9rem_1fr_1fr_auto]">
      <select
        value={reference.type}
        onChange={(event) => onChange({ type: event.target.value as ReferenceType })}
        className="h-10 rounded-xl border border-border/70 bg-background px-3 text-sm font-bold outline-none"
      >
        <option value="commentary">Commentary</option>
        <option value="sermon">Sermon</option>
        <option value="book">Book</option>
        <option value="article">Article</option>
        <option value="other">Other</option>
      </select>
      <Input value={reference.title} onChange={(event) => onChange({ title: event.target.value })} placeholder="Title" className="h-10 rounded-xl bg-background" />
      <Input value={reference.author} onChange={(event) => onChange({ author: event.target.value })} placeholder="Author / source" className="h-10 rounded-xl bg-background" />
      <Button type="button" variant="ghost" size="icon" className="h-10 w-10 rounded-xl text-destructive hover:bg-destructive/10" onClick={onRemove}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
    <div className="mt-2 grid gap-2 md:grid-cols-2">
      <Input value={reference.url} onChange={(event) => onChange({ url: event.target.value })} placeholder="URL" className="h-10 rounded-xl bg-background" />
      <Input value={reference.notes} onChange={(event) => onChange({ notes: event.target.value })} placeholder="Notes" className="h-10 rounded-xl bg-background" />
    </div>
  </Card>
);

const MediaEditor = ({
  media,
  onChange,
  onRemove,
}: {
  media: HubMedia;
  onChange: (updates: Partial<HubMedia>) => void;
  onRemove: () => void;
}) => {
  const embedUrl = media.type === "youtube" ? getYoutubeEmbedUrl(media.url) : "";

  return (
    <Card className="actsix-panel-soft overflow-hidden">
      <div className="space-y-2 p-3">
        <div className="grid grid-cols-[8rem_1fr_auto] gap-2">
          <select
            value={media.type}
            onChange={(event) => onChange({ type: event.target.value as MediaType })}
            className="h-10 rounded-xl border border-border/70 bg-background px-3 text-sm font-bold outline-none"
          >
            <option value="image">Image</option>
            <option value="youtube">YouTube</option>
            <option value="link">Link</option>
          </select>
          <Input value={media.title} onChange={(event) => onChange({ title: event.target.value })} placeholder="Title" className="h-10 rounded-xl bg-background" />
          <Button type="button" variant="ghost" size="icon" className="h-10 w-10 rounded-xl text-destructive hover:bg-destructive/10" onClick={onRemove}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
        <Input value={media.url} onChange={(event) => onChange({ url: event.target.value })} placeholder="URL" className="h-10 rounded-xl bg-background" />
      </div>
      {media.type === "image" && media.url && (
        <img src={media.url} alt={media.title || "Teaching media"} className="max-h-52 w-full border-t border-border/60 object-cover" />
      )}
      {embedUrl && (
        <div className="aspect-video border-t border-border/60">
          <iframe className="h-full w-full" src={embedUrl} title={media.title || "YouTube sermon"} allowFullScreen />
        </div>
      )}
    </Card>
  );
};

const LibrarySection = ({
  title,
  items,
  query,
  onQueryChange,
  typeFilter,
  onTypeFilterChange,
  statusFilter,
  onStatusFilterChange,
  archive,
  onEdit,
  onDelete,
  onArchive,
  onExportPdf,
  onExportWord,
}: {
  title: string;
  items: HubItem[];
  query: string;
  onQueryChange: (query: string) => void;
  typeFilter: "all" | HubItemType;
  onTypeFilterChange: (type: "all" | HubItemType) => void;
  statusFilter: "all" | HubItemStatus;
  onStatusFilterChange: (status: "all" | HubItemStatus) => void;
  archive?: boolean;
  onEdit: (item: HubItem) => void;
  onDelete: (id: string) => void;
  onArchive: (item: HubItem) => void;
  onExportPdf: (item: HubItem) => void;
  onExportWord: (item: HubItem) => void;
}) => {
  const typeOptions: Array<{ value: "all" | HubItemType; label: string }> = [
    { value: "all", label: "All types" },
    { value: "sermon", label: "Sermons" },
    { value: "lesson", label: "Lessons" },
  ];
  const statusOptions: Array<{ value: "all" | HubItemStatus; label: string }> = archive
    ? [
        { value: "all", label: "All status" },
        { value: "delivered", label: "Delivered" },
        { value: "archived", label: "Archived" },
      ]
    : [
        { value: "all", label: "All status" },
        { value: "idea", label: "Idea" },
        { value: "drafting", label: "Drafting" },
        { value: "ready", label: "Ready" },
      ];

  return (
  <section className="actsix-panel p-4 sm:p-5">
    <div data-testid={archive ? "sermon-hub-archive" : "sermon-hub-active"} className="contents">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <p className="label-eyebrow">{archive ? "Searchable Archive" : "Library"}</p>
        <h2 className="mt-1 text-xl font-extrabold">{title}</h2>
      </div>
      <div className="w-full space-y-1.5 lg:w-64">
        <div className="actsix-search-field">
          <Search className="actsix-search-icon" />
          <Input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            className="actsix-search-input"
            placeholder={archive ? "Search archive..." : "Search active prep..."}
          />
        </div>
        <div className="actsix-filter-pills">
          {typeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onTypeFilterChange(option.value)}
              className={cn(
                "actsix-filter-pill",
                typeFilter === option.value
                  ? "border-brand-teal/35 bg-brand-teal/10 text-brand-teal"
                  : "border-border/70 bg-card/70 text-muted-foreground hover:border-brand-teal/25 hover:bg-brand-teal/5 hover:text-brand-teal"
              )}
            >
              {option.label}
            </button>
          ))}
          {statusOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onStatusFilterChange(option.value)}
              className={cn(
                "actsix-filter-pill",
                statusFilter === option.value
                  ? "border-brand-teal/35 bg-brand-teal/10 text-brand-teal"
                  : "border-border/70 bg-card/70 text-muted-foreground hover:border-brand-teal/25 hover:bg-brand-teal/5 hover:text-brand-teal"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>

    <div className="mt-4 space-y-3">
      {items.length === 0 ? (
        <Card className="actsix-panel-soft p-4 text-center">
          <p className="text-lg font-extrabold">No items found</p>
          <p className="mt-2 text-sm text-muted-foreground">Try a different search or filter.</p>
        </Card>
      ) : (
        items.map((item) => (
          <Card key={item.id} className="actsix-panel-soft overflow-hidden transition hover:border-brand-teal/25">
            <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_16rem]">
              <div className="min-w-0 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="rounded-full border-brand-teal/20 bg-brand-teal/10 text-[11px] font-extrabold uppercase text-brand-teal">
                    {item.type}
                  </Badge>
                  <Badge variant="outline" className={cn("rounded-full text-[11px] font-extrabold", statusStyles[item.status])}>
                    {statusLabels[item.status]}
                  </Badge>
                  {item.series && <span className="text-xs font-bold text-muted-foreground">{item.series}</span>}
                </div>
                <h3 className="mt-2 text-lg font-extrabold leading-tight">{item.title}</h3>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold text-muted-foreground">
                  <span>{item.scripture || "No scripture"}</span>
                  <span>{item.audience || "No audience"}</span>
                  <span>{formatDate(item.scheduledDate)}</span>
                </div>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                  {item.summary || stripHtml(item.contentHtml) || "No content yet."}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 border-t border-border/70 bg-background/60 p-3 lg:border-l lg:border-t-0">
                <Button type="button" variant="outline" className="actsix-btn-outline h-9 rounded-xl text-xs" onClick={() => onEdit(item)}>
                  <Pencil className="h-4 w-4" />
                  Edit
                </Button>
                <Button type="button" variant="outline" className="actsix-btn-outline h-9 rounded-xl text-xs" onClick={() => onExportPdf(item)}>
                  <Printer className="h-4 w-4" />
                  PDF
                </Button>
                <Button type="button" variant="outline" className="actsix-btn-outline h-9 rounded-xl text-xs" onClick={() => onExportWord(item)}>
                  <Download className="h-4 w-4" />
                  Word
                </Button>
                <Button type="button" variant="outline" className="actsix-btn-outline h-9 rounded-xl text-xs" onClick={() => onArchive(item)}>
                  <Archive className="h-4 w-4" />
                  {archive ? "Restore" : "Archive"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="col-span-2 h-9 rounded-xl text-xs font-extrabold text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => onDelete(item.id)}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </div>
            </div>
          </Card>
        ))
      )}
    </div>
    </div>
  </section>
  );
};

const StatTile = ({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Mic2;
  label: string;
  value: number;
}) => (
  <Card className="actsix-panel-soft p-4">
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="label-eyebrow">{label}</p>
        <p className="mt-1 text-2xl font-extrabold tabular-nums">{value}</p>
      </div>
      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-brand-teal/15 bg-brand-teal/10 text-brand-teal">
        <Icon className="h-5 w-5" />
      </div>
    </div>
  </Card>
);
