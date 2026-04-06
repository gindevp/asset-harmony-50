import { ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FilterField {
  key: string;
  label: string;
  type: 'text' | 'select';
  options?: { value: string; label: string }[];
  placeholder?: string;
  /** Thêm class cho ô tìm (vd `flex-1 min-w-[12rem] max-w-xl w-full`) */
  inputClassName?: string;
}

interface FilterBarProps {
  fields: FilterField[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onReset: () => void;
  children?: ReactNode;
}

export const FilterBar = ({ fields, values, onChange, onReset, children }: FilterBarProps) => (
  <div className="filter-bar flex flex-wrap items-center gap-2">
    {fields.map(f => (
      <div key={f.key} className="flex-shrink-0">
        {f.type === 'text' ? (
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={f.placeholder || f.label}
              value={values[f.key] || ''}
              onChange={e => onChange(f.key, e.target.value)}
              className={cn('pl-9 h-9 w-48', f.inputClassName)}
            />
          </div>
        ) : (
          <Select value={values[f.key] || 'all'} onValueChange={v => onChange(f.key, v === 'all' ? '' : v)}>
            <SelectTrigger className="w-44 h-9">
              <SelectValue placeholder={f.label} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả {f.label.toLowerCase()}</SelectItem>
              {f.options
                ?.filter(o => o.value !== '')
                .map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
            </SelectContent>
          </Select>
        )}
      </div>
    ))}
    <Button variant="ghost" size="sm" onClick={onReset} className="h-9">
      <X className="h-4 w-4 mr-1" /> Xóa lọc
    </Button>
    {children}
  </div>
);
