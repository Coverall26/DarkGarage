"use client";

import { useCallback } from "react";

import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { type JSONContent } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  ImageIcon,
  Italic,
  List,
  ListOrdered,
  Quote,
  Redo,
  Undo,
} from "lucide-react";

import { Button } from "@/components/ui/button";

interface RichTextEditorProps {
  content?: JSONContent | string;
  onChange?: (content: JSONContent) => void;
  placeholder?: string;
  onImageUpload?: (file: File) => Promise<string>;
}

export function RichTextEditor({
  content,
  onChange,
  placeholder = "Start typing...",
  onImageUpload,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({
        inline: true,
        allowBase64: true,
        HTMLAttributes: {
          class: "rounded-lg max-w-full h-auto",
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content,
    immediatelyRender: false, // Fix SSR hydration issues
    onUpdate: ({ editor }) => {
      onChange?.(editor.getJSON());
    },
    editorProps: {
      handleDrop: (view, event, slice, moved) => {
        if (
          !moved &&
          event.dataTransfer &&
          event.dataTransfer.files &&
          event.dataTransfer.files[0]
        ) {
          const file = event.dataTransfer.files[0];

          // Check if it's an image file
          if (file.type.startsWith("image/") && onImageUpload) {
            event.preventDefault();

            // Upload the image
            onImageUpload(file)
              .then((url) => {
                const { state } = view;
                const { selection } = state;
                const position = selection.empty
                  ? selection.from
                  : selection.to;

                const node = state.schema.nodes.image.create({ src: url });
                const transaction = state.tr.insert(position, node);
                view.dispatch(transaction);
              })
              .catch((error) => {
                console.error("Failed to upload dropped image:", error);
              });

            return true;
          }
        }
        return false;
      },
      handlePaste: (view, event, slice) => {
        const items = event.clipboardData?.items;
        if (items && onImageUpload) {
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.type.startsWith("image/")) {
              event.preventDefault();

              const file = item.getAsFile();
              if (file) {
                onImageUpload(file)
                  .then((url) => {
                    const { state } = view;
                    const { selection } = state;
                    const position = selection.empty
                      ? selection.from
                      : selection.to;

                    const node = state.schema.nodes.image.create({ src: url });
                    const transaction = state.tr.insert(position, node);
                    view.dispatch(transaction);
                  })
                  .catch((error) => {
                    console.error("Failed to upload pasted image:", error);
                  });
              }

              return true;
            }
          }
        }
        return false;
      },
    },
  });

  const addImage = useCallback(
    async (e?: React.MouseEvent) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }

      if (!editor || !onImageUpload) return;

      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          try {
            const url = await onImageUpload(file);
            editor.chain().focus().setImage({ src: url }).run();
          } catch (error) {
            console.error("Failed to upload image:", error);
          }
        }
      };
      input.click();
    },
    [editor, onImageUpload],
  );

  if (!editor) {
    return null;
  }

  return (
    <div className="rounded-md border border-input">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-1 border-b border-input p-2">
        <Button
          variant="ghost"
          size="sm"
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={editor.isActive("bold") ? "bg-muted" : ""}
          aria-label="Bold"
          aria-pressed={editor.isActive("bold")}
        >
          <Bold className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={editor.isActive("italic") ? "bg-muted" : ""}
          aria-label="Italic"
          aria-pressed={editor.isActive("italic")}
        >
          <Italic className="h-4 w-4" aria-hidden="true" />
        </Button>
        <div className="mx-1 h-6 w-px bg-border" aria-hidden="true" />
        <Button
          variant="ghost"
          size="sm"
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={editor.isActive("bulletList") ? "bg-muted" : ""}
          aria-label="Bullet list"
          aria-pressed={editor.isActive("bulletList")}
        >
          <List className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={editor.isActive("orderedList") ? "bg-muted" : ""}
          aria-label="Numbered list"
          aria-pressed={editor.isActive("orderedList")}
        >
          <ListOrdered className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={editor.isActive("blockquote") ? "bg-muted" : ""}
          aria-label="Block quote"
          aria-pressed={editor.isActive("blockquote")}
        >
          <Quote className="h-4 w-4" aria-hidden="true" />
        </Button>
        {onImageUpload && (
          <>
            <div className="mx-1 h-6 w-px bg-border" aria-hidden="true" />
            <Button variant="ghost" size="sm" onClick={addImage} type="button" aria-label="Insert image">
              <ImageIcon className="h-4 w-4" aria-hidden="true" />
            </Button>
          </>
        )}
        <div className="mx-1 h-6 w-px bg-border" aria-hidden="true" />
        <Button
          variant="ghost"
          size="sm"
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          aria-label="Undo"
        >
          <Undo className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          aria-label="Redo"
        >
          <Redo className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      {/* Editor */}
      <div className="min-h-[200px] p-3">
        <EditorContent
          editor={editor}
          className="prose prose-sm max-w-none focus:outline-none [&_.ProseMirror]:min-h-[150px] [&_.ProseMirror]:focus:outline-none"
        />
      </div>
    </div>
  );
}
