import { describe, it, expect } from 'vitest';
import { resolve_localized } from './resolve';

describe('resolve_localized', () => {
	it('resolves a plain key to both locales', () => {
		const result = resolve_localized('units.linear');
		expect(result['en-US']).toBe('mm');
		expect(result['ru-RU']).toBe('мм');
	});

	it('resolves a diagnosis-namespace key', () => {
		const result = resolve_localized('diagnosis.regions.cervical');
		expect(result['en-US']).toBe('Cervical region');
		expect(result['ru-RU']).toBe('Шейный отдел');
	});

	it('interpolates a plain string/number param per locale', () => {
		const result = resolve_localized('diagnosis.rules.sagittal.scheuermann', { grade: 2 });
		expect(result['en-US']).toBe("Scheuermann's disease grade 2");
		expect(result['ru-RU']).toBe('Болезнь Шойермана-Мау 2 ст');
	});

	it('substitutes a Localized param with the matching-locale variant per output locale', () => {
		const side = resolve_localized('diagnosis.rules.frontal.side.left');
		const result = resolve_localized('diagnosis.rules.frontal.regional.scoliosis', {
			side,
			grade: 2,
			angle: '12.3'
		});
		expect(result['en-US']).toBe(
			'Scoliotic deformity (left-sided) Chaklin grade 2, central angle 12.3°'
		);
		expect(result['ru-RU']).toBe(
			'Сколиотическая деформация (левосторонняя) 2 ст по Чаклину, центральный угол 12.3°'
		);
	});

	it('throws on a missing key', () => {
		expect(() => resolve_localized('diagnosis.nope.missing')).toThrow();
	});

	it('leaves a placeholder unchanged when no matching param is supplied', () => {
		const result = resolve_localized('diagnosis.rules.sagittal.scheuermann', {});
		expect(result['en-US']).toBe("Scheuermann's disease grade {grade}");
	});
});
