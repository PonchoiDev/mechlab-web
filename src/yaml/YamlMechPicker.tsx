import { useId, useMemo, useState, type KeyboardEvent } from 'react';
import { CheckboxDropdown } from '../components/CheckboxDropdown';
import { FilterStepper } from '../components/FilterStepper';
import { readOwnedDlcs, useRememberOwnedDlcs } from '../hooks/useOwnedDlcs';
import type { YamlMech } from '../types/yaml-mechlab';
import {
  BASE_GAME, CONTENT_SOURCES, describeContentSources, describeSelection, GAME_START_YEAR, getContentSourceLabel, HARDPOINT_ABBREVIATIONS
} from '../utils/mechs';
import {
  countYamlFilters, EMPTY_YAML_FILTERS, filterYamlMechs, getYamlAvailableYear, getYamlHardpointCounts, getYamlQuirkOptions,
  getYamlRoles, WEIGHT_CLASSES, YAML_HARDPOINT_FILTER_TYPES, type YamlHardpointFilterType, type YamlMechFilters, type YamlWeightClass
} from '../utils/yaml/mechList';

// Selector de 'Mech del MechLab de YAML con el marcado y los filtros del de MW5 (MechPicker) que tienen sentido con
// YAML, y los propios de YAML (docs/specs/filtros-yaml.md).

interface YamlMechPickerProps {
  mechs: YamlMech[];
  current: YamlMech;
  onSelect: (mech: YamlMech) => void;
}

const CLASS_LABELS: Record<YamlWeightClass, string> = { light: 'Light', medium: 'Medium', heavy: 'Heavy', assault: 'Assault' };
const ABBREVIATIONS: Record<YamlHardpointFilterType, string> = { ...HARDPOINT_ABBREVIATIONS, melee: 'MEL' };
// Hay 'Mechs con más de diez anclajes de un tipo, como en MW5.
const MAX_MINIMUM = 20;

const toggleValue = <T,>(values: T[], value: T): T[] =>
  values.includes(value) ? values.filter(current => current !== value) : [...values, value];

// Los anclajes de cada tipo, sin tamaño: en YAML el tamaño no limita qué arma cabe.
function YamlHardpointSummary({ mech }: { mech: YamlMech }) {
  const counts = getYamlHardpointCounts(mech);
  return (
    <span className="mech-option-hardpoints">
      {YAML_HARDPOINT_FILTER_TYPES.filter(type => counts[type] > 0).map(type => (
        <span key={type} className="mech-hardpoint-tag" data-weapon-type={type} title={`${counts[type]} ${type} hardpoint${counts[type] > 1 ? 's' : ''}`}>
          {counts[type]}{ABBREVIATIONS[type]}
        </span>
      ))}
      {mech.yamlOnly && <span className="mech-hardpoint-tag is-dlc" title="Variant added by YAML">YAML</span>}
      {mech.dlc !== undefined && <span className="mech-hardpoint-tag is-dlc" title={`Comes with DLC ${mech.dlc}`}>{getContentSourceLabel(mech.dlc)}</span>}
    </span>
  );
}

export function YamlMechPicker({ mechs, current, onSelect }: YamlMechPickerProps) {
  const idPrefix = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeOption, setActiveOption] = useState(0);
  // Los DLC marcados son los del jugador: los mismos que en el selector de MW5.
  const [filters, setFilters] = useState<YamlMechFilters>(() => ({ ...EMPTY_YAML_FILTERS, dlcs: readOwnedDlcs() }));
  useRememberOwnedDlcs(filters.dlcs);
  const filtered = useMemo(() => filterYamlMechs(mechs, query, filters), [mechs, query, filters]);
  const activeFilterCount = countYamlFilters(filters);
  const roles = useMemo(() => getYamlRoles(mechs), [mechs]);
  const quirkOptions = useMemo(() => getYamlQuirkOptions(mechs), [mechs]);
  const years = useMemo(() => {
    const lastYear = Math.max(GAME_START_YEAR, ...mechs.map(getYamlAvailableYear));
    return Array.from({ length: lastYear - GAME_START_YEAR + 1 }, (_, index) => GAME_START_YEAR + index);
  }, [mechs]);

  // Como en MW5: sin filtros se abre con las variantes del chasis actual; con filtros, con toda la lista filtrada.
  const open = () => {
    if (!isOpen) {
      const initialQuery = activeFilterCount > 0 ? '' : current.chassis;
      setQuery(initialQuery);
      setActiveOption(Math.max(0, filterYamlMechs(mechs, initialQuery, filters).findIndex(mech => mech.id === current.id)));
    }
    setIsOpen(true);
  };
  const close = () => {
    setIsOpen(false);
    setQuery('');
  };
  const select = (mech: YamlMech) => {
    onSelect(mech);
    close();
    (document.activeElement as HTMLElement | null)?.blur();
  };
  // Cada cambio parte del estado más reciente, para no perder clics seguidos.
  const updateFilters = (change: (current: YamlMechFilters) => Partial<YamlMechFilters>) => {
    setFilters(currentFilters => ({ ...currentFilters, ...change(currentFilters) }));
    setActiveOption(0);
  };
  const flag = (key: 'hero' | 'omni' | 'superheavy' | 'yamlOnly', label: string, title: string) => (
    <button
      type="button"
      className="mech-filter-chip"
      aria-pressed={filters[key]}
      title={title}
      onClick={() => updateFilters(currentFilters => ({ [key]: !currentFilters[key] }))}
    >
      {label}
    </button>
  );
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setIsOpen(true);
      setActiveOption(option => Math.min(option + 1, Math.max(filtered.length - 1, 0)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveOption(option => Math.max(option - 1, 0));
    } else if (event.key === 'Enter' && isOpen && filtered[activeOption]) {
      event.preventDefault();
      select(filtered[activeOption]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      close();
      event.currentTarget.blur();
    }
  };

  return (
    <div className="mech-picker is-prominent" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) close(); }}>
      <span>
        CHASSIS / VARIANT
        {activeFilterCount > 0 && <span className="mech-picker-filter-count">{activeFilterCount} {activeFilterCount === 1 ? 'FILTER' : 'FILTERS'}</span>}
      </span>
      <input
        type="search"
        role="combobox"
        aria-label="Search 'Mechs by name, variant, ID or quirk"
        aria-autocomplete="list"
        aria-expanded={isOpen}
        aria-controls={`${idPrefix}-options`}
        autoComplete="off"
        className="mech-picker-input"
        placeholder="Name, variant, quirk or 3e 2mel sh"
        value={isOpen ? query : `${current.chassis} / ${current.variant}`}
        onFocus={open}
        onClick={open}
        onChange={(event) => {
          setQuery(event.target.value);
          setActiveOption(0);
          setIsOpen(true);
        }}
        onKeyDown={handleKeyDown}
      />
      {isOpen && (
        // Como en MW5, pulsar en el panel no se lleva el foco del buscador, salvo el año y los números de los contadores.
        <div
          className="mech-options-panel"
          onMouseDown={(event) => { if (event.target instanceof Element && !event.target.closest('input, select, textarea')) event.preventDefault(); }}
        >
          <div className="mech-filters">
            <div className="mech-filter-row">
              <span className="mech-filter-label">CLASS</span>
              {WEIGHT_CLASSES.map(weightClass => (
                <button
                  key={weightClass}
                  type="button"
                  className="mech-filter-chip"
                  aria-pressed={filters.weightClasses.includes(weightClass)}
                  title={CLASS_LABELS[weightClass]}
                  onClick={() => updateFilters(currentFilters => ({ weightClasses: toggleValue(currentFilters.weightClasses, weightClass) }))}
                >
                  {CLASS_LABELS[weightClass][0]}
                </button>
              ))}
              <span className="mech-filter-label">TECH</span>
              {(['InnerSphere', 'Clan'] as const).map(techBase => (
                <button
                  key={techBase}
                  type="button"
                  className="mech-filter-chip"
                  aria-pressed={filters.techBase === techBase}
                  onClick={() => updateFilters(currentFilters => ({ techBase: currentFilters.techBase === techBase ? null : techBase }))}
                >
                  {techBase === 'InnerSphere' ? 'IS' : 'Clan'}
                </button>
              ))}
              <span className="mech-filter-label">ROLE</span>
              <CheckboxDropdown
                label="Role"
                title="Combat role from the unit card"
                options={roles.map(role => ({ value: role, label: role }))}
                selected={filters.roles}
                summary={describeSelection(filters.roles)}
                onToggle={(role) => updateFilters(currentFilters => ({ roles: toggleValue(currentFilters.roles, role) }))}
                onClear={() => updateFilters(() => ({ roles: [] }))}
              />
            </div>
            <div className="mech-filter-row">
              <span className="mech-filter-label">VARIANT</span>
              <span className="mech-filter-group">
                {flag('hero', 'Hero', "Only hero 'Mechs")}
                {flag('omni', 'Omni', 'Only OmniMechs')}
                {flag('superheavy', 'Superheavy', "Only superheavy 'Mechs, 105 t or more")}
                {flag('yamlOnly', 'YAML only', 'Only the variants added by YAML')}
              </span>
            </div>
            <div className="mech-filter-row">
              <span className="mech-filter-label">QUIRKS</span>
              <span className="yaml-quirk-filter">
                <CheckboxDropdown
                  label="Quirks"
                  title="Only the variants with every marked quirk"
                  options={quirkOptions}
                  selected={filters.quirks}
                  summary={describeSelection(filters.quirks.map(id => quirkOptions.find(option => option.value === id)?.label ?? id))}
                  onToggle={(quirk) => updateFilters(currentFilters => ({ quirks: toggleValue(currentFilters.quirks, quirk) }))}
                  onClear={() => updateFilters(() => ({ quirks: [] }))}
                  searchable
                />
              </span>
            </div>
            <div className="mech-filter-row">
              <span className="mech-filter-label" title="Omni hardpoints count as energy, ballistic or missile">MIN HARDPOINTS</span>
              <span className="mech-filter-group">
              {YAML_HARDPOINT_FILTER_TYPES.map(type => (
                <FilterStepper
                  key={type}
                  type={type}
                  label={`${type} hardpoints`}
                  short={ABBREVIATIONS[type].trim()}
                  value={filters.minHardpoints[type] ?? 0}
                  max={MAX_MINIMUM}
                  onChange={value => updateFilters(currentFilters => ({ minHardpoints: { ...currentFilters.minHardpoints, [type]: value } }))}
                />
              ))}
              </span>
            </div>
            <div className="mech-filter-row">
              <label className="mech-filter-label" htmlFor={`${idPrefix}-year`}>AVAILABLE BY</label>
              <select
                id={`${idPrefix}-year`}
                className="mech-filter-year"
                value={filters.maxYear ?? ''}
                onChange={(event) => {
                  const year = Number.parseInt(event.target.value, 10);
                  updateFilters(() => ({ maxYear: Number.isFinite(year) ? year : null }));
                }}
                onKeyDown={(event) => { if (event.key === 'Escape') close(); }}
              >
                <option value="">Any year</option>
                {years.map(year => <option key={year} value={year}>{year}</option>)}
              </select>
              <span className="mech-filter-label">DLC</span>
              <CheckboxDropdown
                label="DLC"
                title="Show only the 'Mechs from the base game and DLC you own"
                options={CONTENT_SOURCES.map(source => ({ value: source, label: source === BASE_GAME ? 'Base game' : `DLC ${source}` }))}
                selected={filters.dlcs}
                summary={describeContentSources(filters.dlcs)}
                onToggle={(source) => updateFilters(currentFilters => ({ dlcs: toggleValue(currentFilters.dlcs, source) }))}
                onClear={() => updateFilters(() => ({ dlcs: [] }))}
              />
            </div>
            <div className="mech-filter-row mech-filter-summary">
              <span>{filtered.length} {filtered.length === 1 ? 'variant' : 'variants'}</span>
              {activeFilterCount > 0 && (
                <button type="button" className="mech-filter-clear" onClick={() => updateFilters(() => EMPTY_YAML_FILTERS)}>
                  Clear filters
                </button>
              )}
            </div>
          </div>
          <div className="mech-options" id={`${idPrefix}-options`} role="listbox" aria-label="'Mech results">
            {filtered.length > 0 ? filtered.map((mech, index) => (
              <div
                key={mech.id}
                role="option"
                aria-selected={mech.id === current.id}
                className={index === activeOption ? 'mech-option is-active' : 'mech-option'}
                onMouseDown={(event) => event.preventDefault()}
                onMouseMove={() => setActiveOption(index)}
                onClick={() => select(mech)}
              >
                <span>{mech.chassis}</span>
                <strong>
                  {mech.hero && <span className="mech-hero-tag" title="Hero 'Mech">HERO</span>}
                  {mech.variant}
                </strong>
                <YamlHardpointSummary mech={mech} />
                <small>
                  {[`${mech.tonnage} t`, mech.introYear ? getYamlAvailableYear(mech) : null, mech.role, mech.id !== mech.variant ? mech.id : null].filter(Boolean).join(' · ')}
                </small>
              </div>
            )) : <p className="mech-no-results">No 'Mechs match these filters</p>}
          </div>
        </div>
      )}
    </div>
  );
}
