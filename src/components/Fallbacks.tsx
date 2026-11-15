import { useState } from 'react';
import { Shirt } from 'lucide-react';

interface SmartImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  aspectClass?: string;
}

export function SmartImage({ src, alt, className = '', aspectClass = 'aspect-[3/4]' }: SmartImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`${aspectClass} bg-[#EDE8DF] flex flex-col items-center justify-center p-4 text-center border border-[#E5E0D8] ${className}`}
        role="img"
        aria-label={alt}
      >
        <Shirt className="w-8 h-8 text-[#8C5A3C] stroke-[1.25] mb-2" />
        <span className="text-xs font-medium text-[#5C5954] line-clamp-2 max-w-[16ch]">{alt}</span>
      </div>
    );
  }

  return (
    <div className={`${aspectClass} bg-[#F2EFE9] overflow-hidden ${className}`}>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="w-full h-full object-cover object-center transition-transform duration-500 ease-out group-hover:scale-[1.03]"
      />
    </div>
  );
}
