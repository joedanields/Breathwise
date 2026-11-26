import { type KeyboardEvent, type RefObject, useId, useRef, useState } from 'react';
import { formatPlaceLabel, type Place } from './schemas';
import { MIN_QUERY_LENGTH, usePlaceSearch } from './usePlaceSearch';

interface LocationSearchProps {
  onSelect: (place: Place) => void;
  /** Lets the parent move focus to the search box (e.g. after a geolocation error). */
  inputRef?: RefObject<HTMLInputElement | null>;
  /** Id of an extra message (e.g. a geolocation error) the input should announce. */
  describedBy?: string | undefined;
}

/**
 * Place search as an ARIA 1.2 combobox with a listbox popup (UI_UX.md §4):
 * focus stays on the input; arrows move the active option, Enter picks it,
 * Escape closes the list (or clears the input when the list is closed).
 */
export function LocationSearch({ onSelect, inputRef, describedBy }: LocationSearchProps) {
  const id = useId();
  const inputId = `${id}-input`;
  const listboxId = `${id}-listbox`;
  const hintId = `${id}-hint`;
  const statusId = `${id}-status`;

  const [text, setText] = useState('');
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const ownInputRef = useRef<HTMLInputElement | null>(null);
  const inputElementRef = inputRef ?? ownInputRef;

  // Don't search again for the label we just filled in.
  const search = usePlaceSearch(text === selectedLabel ? '' : text);
  const { places } = search;
  const expanded = open && places.length > 0;
  const activePlace = expanded ? places[activeIndex] : undefined;
  const optionId = (place: Place) => `${id}-option-${String(place.id)}`;

  function select(place: Place) {
    const label = formatPlaceLabel(place);
    setText(label);
    setSelectedLabel(label);
    setOpen(false);
    setActiveIndex(-1);
    onSelect(place);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const count = places.length;
    switch (event.key) {
      case 'ArrowDown':
        if (count === 0) return;
        event.preventDefault();
        setOpen(true);
        setActiveIndex(!expanded || activeIndex >= count - 1 ? 0 : activeIndex + 1);
        break;
      case 'ArrowUp':
        if (count === 0) return;
        event.preventDefault();
        setOpen(true);
        setActiveIndex(!expanded || activeIndex <= 0 ? count - 1 : activeIndex - 1);
        break;
      case 'Enter':
        if (activePlace) {
          event.preventDefault();
          select(activePlace);
        }
        break;
      case 'Escape':
        event.preventDefault();
        if (expanded) {
          setOpen(false);
          setActiveIndex(-1);
        } else {
          setText('');
          setSelectedLabel(null);
        }
        break;
    }
  }

  let status = '';
  if (search.isSearching) status = 'Searching…';
  else if (search.isError)
    status = 'Search is unavailable right now. Check your connection and try again.';
  else if (search.isEmpty) status = `No places in India match “${search.query}”.`;
  else if (expanded) {
    const noun = places.length === 1 ? 'place' : 'places';
    status = `${String(places.length)} ${noun} found. Use the up and down arrows to choose.`;
  }

  const describedByIds = [hintId, statusId, describedBy].filter(Boolean).join(' ');

  return (
    <div className="relative">
      <label htmlFor={inputId} className="block font-medium">
        Search for a town or city in India
      </label>
      <p id={hintId} className="text-sm text-muted">
        Type at least {MIN_QUERY_LENGTH} letters.
      </p>
      <input
        ref={inputElementRef}
        id={inputId}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={listboxId}
        aria-activedescendant={activePlace ? optionId(activePlace) : undefined}
        aria-describedby={describedByIds}
        autoComplete="off"
        spellCheck={false}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          setSelectedLabel(null);
          setOpen(true);
          setActiveIndex(-1);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => {
          setOpen(false);
        }}
        onFocus={() => {
          setOpen(true);
        }}
        className="mt-2 block min-h-11 w-full rounded-md border border-muted bg-surface px-3 text-base text-text"
      />
      <div
        id={listboxId}
        role="listbox"
        aria-label="Matching places"
        hidden={!expanded}
        className="absolute z-10 mt-1 max-h-80 w-full overflow-auto rounded-md border border-border bg-surface py-1 shadow-lg"
      >
        {places.map((place, index) => (
          // Keyboard selection happens on the combobox input (aria-activedescendant);
          // options are pointer targets only, per the ARIA combobox pattern.
          // eslint-disable-next-line jsx-a11y/click-events-have-key-events
          <div
            key={place.id}
            id={optionId(place)}
            role="option"
            aria-selected={index === activeIndex}
            tabIndex={-1}
            onMouseDown={(event) => {
              event.preventDefault(); // keep focus on the input
            }}
            onClick={() => {
              select(place);
            }}
            className={`flex min-h-11 cursor-pointer items-center px-3 ${
              index === activeIndex ? 'bg-accent text-on-accent' : 'hover:bg-bg'
            }`}
          >
            {formatPlaceLabel(place)}
          </div>
        ))}
      </div>
      <p id={statusId} role="status" className="mt-2 min-h-6 text-sm text-muted">
        {status}
      </p>
      {search.isError && (
        <button
          type="button"
          onClick={() => {
            search.retry();
            inputElementRef.current?.focus(); // reopens the list for the results
          }}
          className="min-h-11 rounded-md border border-accent px-4 font-medium text-accent"
        >
          Try the search again
        </button>
      )}
    </div>
  );
}
