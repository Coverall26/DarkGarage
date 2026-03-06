"use client";

import { useCallback, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Link as LinkIcon,
  Heading2,
  Quote,
  Undo,
  Redo,
  Code,
  ChevronDown,
  Variable,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Merge Fields
// ---------------------------------------------------------------------------

const MERGE_FIELDS = [
  { label: "Investor Name", tag: "{{investor_name}}" },
  { label: "Fund Name", tag: "{{fund_name}}" },
  { label: "GP Name", tag: "{{gp_name}}" },
  { label: "Commitment Amount", tag: "{{commitment_amount}}" },
  { label: "Investor Email", tag: "{{investor_email}}" },
  { label: "Entity Name", tag: "{{entity_name}}" },
  { label: "Wire Bank", tag: "{{wire_bank}}" },
  { label: "Wire Account", tag: "{{wire_account}}" },
  { label: "Wire Routing", tag: "{{wire_routing}}" },
  { label: "Company", tag: "{{company}}" },
  { label: "Unsubscribe Link", tag: "{{unsubscribe_link}}" },
] as const;

// ---------------------------------------------------------------------------
// Toolbar Button
// ---------------------------------------------------------------------------

function ToolbarBtn({
  active,
  disabled,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={`inline-flex items-center justify-center h-7 w-7 rounded text-sm transition-colors
        ${active ? "bg-[#0066FF]/10 text-[#0066FF]" : "text-muted-foreground hover:bg-muted hover:text-foreground"}
        ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Merge Field Dropdown
// ---------------------------------------------------------------------------

function MergeFieldDropdown({ editor }: { editor: Editor | null }) {
  const [open, setOpen] = useState(false);

  const insertField = useCallback(
    (tag: string) => {
      if (!editor) return;
      editor.chain().focus().insertContent(tag).run();
      setOpen(false);
    },
    [editor],
  );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 h-7 px-2 rounded text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        title="Insert merge field"
        aria-label="Insert merge field"
      >
        <Variable className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="hidden sm:inline">Merge Field</span>
        <ChevronDown className="h-3 w-3" aria-hidden="true" />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          {/* Dropdown */}
          <div className="absolute top-full left-0 mt-1 z-50 w-56 rounded-md border border-border bg-popover shadow-md py-1">
            {MERGE_FIELDS.map((field) => (
              <button
                key={field.tag}
                type="button"
                onClick={() => insertField(field.tag)}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted flex items-center justify-between gap-2"
              >
                <span>{field.label}</span>
                <code className="text-xs text-muted-foreground font-mono">
                  {field.tag}
                </code>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toolbar
// ---------------------------------------------------------------------------

function EditorToolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return null;

  const addLink = useCallback(() => {
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("URL", previousUrl || "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  return (
    <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-border bg-muted/30">
      <ToolbarBtn
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
        title="Bold"
      >
        <Bold className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title="Italic"
      >
        <Italic className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        title="Underline"
      >
        <UnderlineIcon className="h-3.5 w-3.5" />
      </ToolbarBtn>

      <div className="w-px h-4 bg-border mx-1" />

      <ToolbarBtn
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        title="Heading"
      >
        <Heading2 className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        title="Bullet list"
      >
        <List className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        title="Ordered list"
      >
        <ListOrdered className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        title="Quote"
      >
        <Quote className="h-3.5 w-3.5" />
      </ToolbarBtn>

      <div className="w-px h-4 bg-border mx-1" />

      <ToolbarBtn active={editor.isActive("link")} onClick={addLink} title="Link">
        <LinkIcon className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        active={editor.isActive("code")}
        onClick={() => editor.chain().focus().toggleCode().run()}
        title="Inline code"
      >
        <Code className="h-3.5 w-3.5" />
      </ToolbarBtn>

      <div className="w-px h-4 bg-border mx-1" />

      <ToolbarBtn
        disabled={!editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}
        title="Undo"
      >
        <Undo className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        disabled={!editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}
        title="Redo"
      >
        <Redo className="h-3.5 w-3.5" />
      </ToolbarBtn>

      <div className="flex-1" />

      <MergeFieldDropdown editor={editor} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// TemplateEditor
// ---------------------------------------------------------------------------

interface TemplateEditorProps {
  content: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  placeholder?: string;
  minHeight?: string;
}

export function TemplateEditor({
  content,
  onChange,
  disabled = false,
  placeholder = "Write your email template...",
  minHeight = "200px",
}: TemplateEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "text-[#0066FF] underline cursor-pointer" },
      }),
      Underline,
      Placeholder.configure({ placeholder }),
      Image.configure({ inline: true }),
    ],
    content,
    editable: !disabled,
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
    },
    editorProps: {
      attributes: {
        class: `prose prose-sm dark:prose-invert max-w-none px-3 py-2 focus:outline-none`,
        style: `min-height: ${minHeight}`,
      },
    },
  });

  return (
    <div
      className={`rounded-md border border-border overflow-hidden bg-background ${
        disabled ? "opacity-60 pointer-events-none" : ""
      }`}
    >
      <EditorToolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Template Preview (read-only rendered HTML)
// ---------------------------------------------------------------------------

interface TemplatePreviewProps {
  subject: string;
  body: string;
  onClose: () => void;
  templateName: string;
}

export function TemplatePreview({
  subject,
  body,
  onClose,
  templateName,
}: TemplatePreviewProps) {
  // Highlight merge fields with amber background
  const highlightedBody = body.replace(
    /\{\{([^}]+)\}\}/g,
    '<span class="bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-1 rounded text-xs font-mono">{{$1}}</span>',
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-2xl mx-4 bg-background rounded-lg border border-border shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold">Preview: {templateName}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Merge fields highlighted in amber
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-muted text-muted-foreground"
          >
            <span className="sr-only">Close</span>×
          </button>
        </div>

        {/* Email preview */}
        <div className="p-4 space-y-4">
          {/* Subject line */}
          <div className="rounded-md border border-border p-3 bg-muted/30">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
              Subject
            </p>
            <p className="text-sm font-medium">{subject}</p>
          </div>

          {/* Body */}
          <div className="rounded-md border border-border p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
              Body
            </p>
            <div
              className="prose prose-sm dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: highlightedBody }}
            />
          </div>
        </div>

        <div className="p-4 border-t border-border flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose} className="h-8 text-xs">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
