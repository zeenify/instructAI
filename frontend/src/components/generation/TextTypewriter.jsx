import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export default function TextTypewriter({ text, speed = 10 }) {
  const [displayedText, setDisplayedText] = useState('');
  const [cursorVisible, setCursorVisible] = useState(true);

  useEffect(() => {
    setDisplayedText('');
    setCursorVisible(true);
    let i = 0;
    let isActive = true;

    const interval = setInterval(() => {
      if (isActive && i < text.length) {
        setDisplayedText(text.slice(0, i + 1));
        i++;
      } else if (i >= text.length) {
        clearInterval(interval);
        setCursorVisible(false);
      }
    }, speed);

    return () => {
      isActive = false;
      clearInterval(interval);
    };
  }, [text, speed]);

  return (
    <div className="text-slate-300 leading-relaxed font-mono text-base">
      {displayedText}
      {cursorVisible && (
        <motion.span
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.6, repeat: Infinity }}
          className="inline-block w-1 h-5 bg-cyan-400 ml-0.5"
        />
      )}
    </div>
  );
}
