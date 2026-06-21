import { cn } from '@/lib/utils/cn';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

export default function Card({ children, className, hover = false }: CardProps) {
  return (
    <div
      className={cn(
        'bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-2xl p-6',
        hover && 'transition-all duration-300 hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/10 hover:-translate-y-1',
        className
      )}
    >
      {children}
    </div>
  );
}
