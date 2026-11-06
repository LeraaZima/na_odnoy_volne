import { useRef } from 'react';

/** Purple input focus glow that tracks the mouse and the actual text insertion caret. */
export function GlowInput({
  className = '', onChange, onFocus, onClick, onKeyUp, onSelect, onInput, ...props
}) {
  const wrapper = useRef(null);

  const movePointerGlow = event => {
    const rect = wrapper.current?.getBoundingClientRect();
    if (!rect) return;
    wrapper.current.style.setProperty('--glow-x', `${event.clientX - rect.left}px`);
    wrapper.current.style.setProperty('--glow-y', `${event.clientY - rect.top}px`);
  };

  const moveCaretGlow = input => {
    const element = wrapper.current;
    if (!element) return;
    const style = window.getComputedStyle(input);
    const width = input.getBoundingClientRect().width;
    const ctx = document.createElement('canvas').getContext('2d');
    if (!ctx) return;
    ctx.font = style.font || `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const cursor = input.selectionStart ?? input.value.length;
    const beforeCaret = input.value.slice(0, cursor);
    const spacing = parseFloat(style.letterSpacing);
    const textWidth = ctx.measureText(beforeCaret).width
      + (Number.isFinite(spacing) ? spacing * beforeCaret.length : 0);
    const x = parseFloat(style.paddingLeft) + textWidth - input.scrollLeft;
    element.style.setProperty('--caret-x', `${Math.max(17, Math.min(width - 17, x))}px`);
  };

  return (
    <span className="glow-field" ref={wrapper} onPointerMove={movePointerGlow}>
      <input {...props} className={className}
        onChange={e => { onChange?.(e); moveCaretGlow(e.currentTarget); }}
        onInput={e => { onInput?.(e); moveCaretGlow(e.currentTarget); }}
        onFocus={e => { onFocus?.(e); moveCaretGlow(e.currentTarget); }}
        onClick={e => { onClick?.(e); moveCaretGlow(e.currentTarget); }}
        onKeyUp={e => { onKeyUp?.(e); moveCaretGlow(e.currentTarget); }}
        onSelect={e => { onSelect?.(e); moveCaretGlow(e.currentTarget); }}
      />
    </span>
  );
}
