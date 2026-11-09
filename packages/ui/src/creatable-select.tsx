import { useId, useState } from "react";
import { Combobox } from "@base-ui/react/combobox";
import { Check, ChevronDown, X } from "lucide-react";
import { Input } from "./primitives/input";

export function CreatableSelect({
  label,
  value,
  options,
  maxLength,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  maxLength: number;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const inputId = useId();
  const [query, setQuery] = useState(value);
  const typed = query.trim();
  const known = value === "" || options.includes(value) ? options : [value, ...options];
  const items = typed === "" || known.includes(typed) ? known : [...known, typed];

  function select(next: string) {
    setQuery(next);
    onChange(next);
  }

  return (
    <div className="field">
      <Combobox.Root
        items={items}
        value={value === "" ? null : value}
        inputValue={query}
        disabled={disabled}
        autoHighlight
        onValueChange={(next: string | null) => select(next ?? "")}
        onInputValueChange={setQuery}
      >
        <label className="field-label" htmlFor={inputId}>
          {label}
        </label>
        <Combobox.InputGroup className="combobox-group">
          <Combobox.Input
            id={inputId}
            placeholder="未設定"
            maxLength={maxLength}
            enterKeyHint="next"
            render={<Input />}
            onBlur={() => {
              if (typed !== value) select(typed);
            }}
          />
          {value === "" ? (
            <Combobox.Trigger className="combobox-action" aria-label={`${label}の一覧を開く`}>
              <ChevronDown aria-hidden="true" />
            </Combobox.Trigger>
          ) : (
            <Combobox.Clear className="combobox-action" aria-label={`${label}を消去`}>
              <X aria-hidden="true" />
            </Combobox.Clear>
          )}
        </Combobox.InputGroup>
        <Combobox.Portal>
          <Combobox.Positioner className="combobox-positioner" sideOffset={4}>
            <Combobox.Popup className="combobox-popup">
              <Combobox.Empty className="combobox-empty">
                名前を入力すると追加できます
              </Combobox.Empty>
              <Combobox.List>
                {(item: string) => (
                  <Combobox.Item key={item} value={item} className="combobox-item">
                    <span>{known.includes(item) ? item : `「${item}」を追加`}</span>
                    <Combobox.ItemIndicator>
                      <Check aria-hidden="true" />
                    </Combobox.ItemIndicator>
                  </Combobox.Item>
                )}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    </div>
  );
}
