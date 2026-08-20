import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { DateRangePicker } from '../date-range-picker';

describe('DateRangePicker', () => {
  it('propaga id al Button trigger', () => {
    render(
      <DateRangePicker
        date={{ from: undefined, to: undefined }}
        onDateChange={() => {}}
        id="date-test"
      />
    );
    expect(document.getElementById('date-test')).toBeDefined();
    expect(document.getElementById('date-test')?.tagName).toBe('BUTTON');
  });
});
