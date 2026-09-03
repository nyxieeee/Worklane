/**
 * ProfileBorderPicker
 * Renders a live avatar preview + grouped border style swatches.
 * Used in SettingsModal (self) and MembersModal (owner can set for any member).
 */
import React from 'react';
import { Check, Code2, Globe, Server, Cpu, TestTube2, Layers3, Smartphone, BarChart2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { BORDER_PRESETS, type BorderPreset } from '../../types';
import { avatarInitials } from '../../utils';
import AvatarBorder from './AvatarBorder';

interface ProfileBorderPickerProps {
  /** The member's (or current user's) name */
  name: string;
  /** The member's avatar URL, if any */
  avatarUrl?: string;
  /** The member's initials fallback colour */
  color?: string;
  /** Currently selected border style key */
  value: string;
  /** Called when a new border preset is selected */
  onChange: (key: string) => void;
}

function getBorderIcon(key: string): React.ReactNode {
  const s = 11;
  switch (key) {
    case 'frontend':  return <Globe size={s} />;
    case 'backend':   return <Server size={s} />;
    case 'devops':    return <Cpu size={s} />;
    case 'designer':  return <Layers3 size={s} />;
    case 'qa':        return <TestTube2 size={s} />;
    case 'fullstack': return <Code2 size={s} />;
    case 'mobile':    return <Smartphone size={s} />;
    case 'data':      return <BarChart2 size={s} />;
    default:          return null;
  }
}

function SwatchPreview({ preset, size = 28 }: { preset: BorderPreset; size?: number }) {
  if (preset.key === 'none') {
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%',
        border: '1.5px solid hsl(var(--border))',
        backgroundColor: 'hsl(var(--muted))',
      }} />
    );
  }
  if (preset.key === 'solid') {
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%',
        border: '2.5px solid hsl(var(--primary))',
        backgroundColor: 'hsl(var(--muted))',
      }} />
    );
  }
  if (preset.key === 'dashed') {
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%',
        border: '2px dashed hsl(var(--primary))',
        backgroundColor: 'hsl(var(--muted))',
      }} />
    );
  }
  if (preset.key === 'glow') {
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%',
        border: '2px solid hsl(var(--primary))',
        boxShadow: '0 0 0 2px hsl(var(--primary) / 0.22), 0 0 10px 2px hsl(var(--primary) / 0.4)',
        backgroundColor: 'hsl(var(--muted))',
      }} />
    );
  }
  // Gradient swatch
  const gap = 2;
  return (
    <div style={{
      width: size + gap * 2, height: size + gap * 2, borderRadius: '50%',
      background: preset.gradient,
      padding: gap, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        width: size, height: size, borderRadius: '50%',
        backgroundColor: 'hsl(var(--muted))',
      }} />
    </div>
  );
}

export default function ProfileBorderPicker({
  name, avatarUrl, color, value, onChange,
}: ProfileBorderPickerProps) {
  const itPresets   = BORDER_PRESETS.filter(p => p.group === 'it');
  const genPresets  = BORDER_PRESETS.filter(p => p.group === 'general');
  const selectedPreset = BORDER_PRESETS.find(p => p.key === value) || BORDER_PRESETS.find(p => p.key === 'none')!;

  const avatarContent = avatarUrl ? (
    <img src={avatarUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
  ) : (
    <div style={{
      width: '100%', height: '100%', borderRadius: '50%',
      backgroundColor: color || 'hsl(var(--primary))',
      color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 20, fontWeight: 800,
    }}>
      {avatarInitials(name || 'U')}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Live Preview */}
      <div style={{
        padding: '14px 18px',
        borderRadius: 14,
        backgroundColor: 'hsl(var(--background))',
        boxShadow: 'var(--neu-shadow-raised-sm)',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
      }}>
        <AvatarBorder borderStyle={value} size={64}>
          {avatarContent}
        </AvatarBorder>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'hsl(var(--foreground))' }}>{name || 'Member'}</div>
          <div style={{ fontSize: 11.5, color: 'hsl(var(--muted-foreground))' }}>
            {selectedPreset?.label || 'No Border'}
          </div>
          {selectedPreset?.group === 'it' && (
            <div style={{
              marginTop: 4,
              fontSize: 10.5, fontWeight: 700,
              padding: '2px 8px', borderRadius: 9999,
              background: 'hsl(var(--primary) / 0.12)',
              color: 'hsl(var(--primary))',
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}>
              {getBorderIcon(selectedPreset.key)}
              IT Role
            </div>
          )}
        </div>
      </div>

      {/* IT Roles Group */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{
          fontSize: 11.5, fontWeight: 700,
          color: 'hsl(var(--muted-foreground))',
          textTransform: 'uppercase', letterSpacing: '0.06em',
          display: 'flex', alignItems: 'center', gap: 6
        }}>
          <Code2 size={12} style={{ color: 'hsl(var(--primary))' }} />
          IT / Tech Roles
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {itPresets.map(preset => {
            const isSelected = value === preset.key;
            return (
              <motion.button
                key={preset.key}
                whileTap={{ scale: 0.93 }}
                whileHover={{ scale: 1.04 }}
                type="button"
                onClick={() => onChange(preset.key)}
                title={preset.label}
                style={{
                  border: isSelected ? '1.5px solid hsl(var(--primary))' : '1px solid hsl(var(--border) / 0.6)',
                  borderRadius: 10,
                  padding: '8px 6px',
                  backgroundColor: isSelected ? 'hsl(var(--primary) / 0.08)' : 'hsl(var(--card))',
                  boxShadow: isSelected ? 'var(--neu-shadow-raised-sm)' : 'var(--neu-shadow-input)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.12s ease',
                  position: 'relative',
                }}
              >
                {isSelected && (
                  <div style={{
                    position: 'absolute', top: 3, right: 3,
                    width: 14, height: 14, borderRadius: '50%',
                    backgroundColor: 'hsl(var(--primary))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Check size={9} color="#fff" strokeWidth={3} />
                  </div>
                )}
                <SwatchPreview preset={preset} size={22} />
                <span style={{
                  fontSize: 9.5, fontWeight: 600, lineHeight: 1.2, textAlign: 'center',
                  color: isSelected ? 'hsl(var(--primary))' : 'hsl(var(--foreground))',
                }}>
                  {preset.label}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* General Group */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{
          fontSize: 11.5, fontWeight: 700,
          color: 'hsl(var(--muted-foreground))',
          textTransform: 'uppercase', letterSpacing: '0.06em',
          display: 'flex', alignItems: 'center', gap: 6
        }}>
          <span style={{ fontSize: 12 }}>✦</span>
          General Styles
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
          {genPresets.map(preset => {
            const isSelected = value === preset.key;
            return (
              <motion.button
                key={preset.key}
                whileTap={{ scale: 0.93 }}
                whileHover={{ scale: 1.04 }}
                type="button"
                onClick={() => onChange(preset.key)}
                title={preset.label}
                style={{
                  border: isSelected ? '1.5px solid hsl(var(--primary))' : '1px solid hsl(var(--border) / 0.6)',
                  borderRadius: 10,
                  padding: '8px 6px',
                  backgroundColor: isSelected ? 'hsl(var(--primary) / 0.08)' : 'hsl(var(--card))',
                  boxShadow: isSelected ? 'var(--neu-shadow-raised-sm)' : 'var(--neu-shadow-input)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.12s ease',
                  position: 'relative',
                }}
              >
                {isSelected && (
                  <div style={{
                    position: 'absolute', top: 3, right: 3,
                    width: 14, height: 14, borderRadius: '50%',
                    backgroundColor: 'hsl(var(--primary))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Check size={9} color="#fff" strokeWidth={3} />
                  </div>
                )}
                <SwatchPreview preset={preset} size={22} />
                <span style={{
                  fontSize: 9.5, fontWeight: 600, lineHeight: 1.2, textAlign: 'center',
                  color: isSelected ? 'hsl(var(--primary))' : 'hsl(var(--foreground))',
                }}>
                  {preset.label}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
