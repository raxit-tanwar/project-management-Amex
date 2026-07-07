'use client'

import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import {
    Bold, Italic, Strikethrough, List, ListOrdered,
    Heading2, Quote, Undo, Redo, type LucideIcon,
} from 'lucide-react'

interface RichTextEditorProps {
    content: string
    onChange: (html: string) => void
    placeholder?: string
}

function ToolbarButton({ active, disabled, onClick, title, Icon }: {
    active?: boolean
    disabled?: boolean
    onClick: () => void
    title: string
    Icon: LucideIcon
}) {
    return (
        <button
            type="button"
            title={title}
            disabled={disabled}
            onClick={onClick}
            style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 28, height: 28, padding: 0, borderRadius: 'var(--radius-sm)',
                border: '1px solid transparent', cursor: disabled ? 'not-allowed' : 'pointer',
                background: active ? 'var(--accent-dim)' : 'transparent',
                color: active ? 'var(--accent)' : 'var(--text-muted)',
                opacity: disabled ? 0.4 : 1,
                transition: 'all 0.15s ease',
            }}
        >
            <Icon size={14} />
        </button>
    )
}

function Toolbar({ editor }: { editor: Editor }) {
    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap',
            padding: '6px 8px', borderBottom: '1px solid var(--border)', background: 'var(--surface2)',
        }}>
            <ToolbarButton title="Bold" Icon={Bold} active={editor.isActive('bold')}
                onClick={() => editor.chain().focus().toggleBold().run()} />
            <ToolbarButton title="Italic" Icon={Italic} active={editor.isActive('italic')}
                onClick={() => editor.chain().focus().toggleItalic().run()} />
            <ToolbarButton title="Strikethrough" Icon={Strikethrough} active={editor.isActive('strike')}
                onClick={() => editor.chain().focus().toggleStrike().run()} />
            <div style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 4px' }} />
            <ToolbarButton title="Heading" Icon={Heading2} active={editor.isActive('heading', { level: 2 })}
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} />
            <ToolbarButton title="Bullet list" Icon={List} active={editor.isActive('bulletList')}
                onClick={() => editor.chain().focus().toggleBulletList().run()} />
            <ToolbarButton title="Numbered list" Icon={ListOrdered} active={editor.isActive('orderedList')}
                onClick={() => editor.chain().focus().toggleOrderedList().run()} />
            <ToolbarButton title="Quote" Icon={Quote} active={editor.isActive('blockquote')}
                onClick={() => editor.chain().focus().toggleBlockquote().run()} />
            <div style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 4px' }} />
            <ToolbarButton title="Undo" Icon={Undo} disabled={!editor.can().undo()}
                onClick={() => editor.chain().focus().undo().run()} />
            <ToolbarButton title="Redo" Icon={Redo} disabled={!editor.can().redo()}
                onClick={() => editor.chain().focus().redo().run()} />
        </div>
    )
}

// Rich-text editor used for the Settings > Build Notes panel. `content` seeds the
// editor once on mount (uncontrolled after that, like the rest of this app's inputs);
// every keystroke bubbles the latest HTML up via onChange so the parent can hold it in
// local state until the user clicks Save.
export default function RichTextEditor({ content, onChange, placeholder }: RichTextEditorProps) {
    const editor = useEditor({
        extensions: [
            StarterKit,
            Placeholder.configure({ placeholder: placeholder ?? 'Start typing…' }),
        ],
        content,
        immediatelyRender: false,
        onUpdate: ({ editor }) => onChange(editor.getHTML()),
        editorProps: {
            attributes: { class: 'rich-text-content rich-text-editable' },
        },
    })

    if (!editor) {
        return <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', minHeight: 160, background: 'var(--surface2)' }} />
    }

    return (
        <div style={{ border: '1px solid var(--border2)', borderRadius: 'var(--radius)', overflow: 'hidden', background: 'var(--surface)', boxShadow: 'var(--shadow-xs)' }}>
            <Toolbar editor={editor} />
            <EditorContent editor={editor} />
        </div>
    )
}
