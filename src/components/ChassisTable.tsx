import type { ReactNode } from 'react';
import type { ColumnSort } from '../utils/tableSort';

// La tabla de las listas de chasis de MW5 y de BATTLETECH: cada columna ordena al pulsar su cabecera, y el
// nombre de cada variante es un enlace a su build de serie en el MechLab.

export interface ChassisColumn<R, K extends string> {
  key: Exclude<K, 'name'>;
  label: string;
  title?: string;
  value: (row: R) => ReactNode;
}

interface ChassisTableProps<R, K extends string> {
  rows: R[];
  columns: ChassisColumn<R, K>[];
  sort: ColumnSort<K>;
  onSort: (key: K) => void;
  rowKey: (row: R) => string;
  link: (row: R) => string;
  // El chasis y la variante, y debajo lo que se sabe de ella (rol, tecnología, equipo fijo).
  name: (row: R) => { chassis: string; variant: string; meta: ReactNode };
}

function SortButton<K extends string>({ sort, sortKey, label, title, onSort }: {
  sort: ColumnSort<K>; sortKey: K; label: string; title?: string; onSort: (key: K) => void;
}) {
  const active = sort.key === sortKey;
  return (
    <button type="button" className={active ? 'is-active' : undefined} title={title} onClick={() => onSort(sortKey)}>
      {label}
      <span aria-hidden="true">{active ? (sort.dir === 'asc' ? '▲' : '▼') : ''}</span>
    </button>
  );
}

export function ChassisTable<R, K extends string>({ rows, columns, sort, onSort, rowKey, link, name }: ChassisTableProps<R, K>) {
  const ariaSort = (key: K) => sort.key === key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined;
  return (
    <div className="arsenal-table-wrap">
      <table className="arsenal-table chassis-table">
        <thead>
          <tr>
            <th scope="col" aria-sort={ariaSort('name' as K)}>
              <SortButton sort={sort} sortKey={'name' as K} label="'Mech" onSort={onSort} />
            </th>
            {columns.map(column => (
              <th key={column.key} scope="col" aria-sort={ariaSort(column.key)} className={`is-${column.key}`}>
                <SortButton sort={sort} sortKey={column.key as K} label={column.label} title={column.title} onSort={onSort} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const { chassis, variant, meta } = name(row);
            return (
              <tr key={rowKey(row)}>
                <th scope="row">
                  <a className="chassis-link" href={link(row)} title="Open its stock build in the MechLab">
                    <span className="arsenal-weapon-name">{chassis} <span className="chassis-variant">{variant}</span></span>
                  </a>
                  <span className="arsenal-weapon-meta">{meta}</span>
                </th>
                {columns.map(column => (
                  <td key={column.key} className={`is-${column.key}`}>{column.value(row)}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Un contador de mínimo (anclajes o retrorreactores), como los del selector de 'Mechs.
export function MinimumStepper({ type, label, short, value, max, onChange }: {
  type: string; label: string; short: string; value: number; max: number; onChange: (value: number) => void;
}) {
  return (
    <span className={value > 0 ? 'chassis-stepper is-active' : 'chassis-stepper'} data-type={type}>
      <button type="button" aria-label={`Fewer ${label}`} disabled={value === 0} onClick={() => onChange(value - 1)}>−</button>
      <span><b>{value}</b>{short}</span>
      <button type="button" aria-label={`More ${label}`} disabled={value === max} onClick={() => onChange(value + 1)}>+</button>
    </span>
  );
}
