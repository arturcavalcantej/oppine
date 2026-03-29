type LogoProps = {
  variant?: 'full' | 'icon';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  className?: string;
  inverted?: boolean;
};

const sizes = {
  xs: { height: 22 },
  sm: { height: 28 },
  md: { height: 36 },
  lg: { height: 44 },
  xl: { height: 52 },
  '2xl': { height: 72 },
  '3xl': { height: 96 },
};

export function Logo({ variant = 'full', size = 'md', className = '', inverted = false }: LogoProps) {
  const { height } = sizes[size];

  // Use white/inverted logo for dark backgrounds
  const logoSrc = variant === 'icon'
    ? '/cinza.png'
    : (inverted ? '/logo-3.png' : '/logo-full.png');

  // Icon variant uses width constraint to maintain aspect ratio
  const style = variant === 'icon'
    ? { width: `${height}px`, height: 'auto' }
    : { height: `${height}px`, width: 'auto' };

  return (
    <img
      src={logoSrc}
      alt="OPPINE"
      className={className}
      style={style}
    />
  );
}
