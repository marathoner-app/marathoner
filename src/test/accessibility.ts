import axe, { type ElementContext } from 'axe-core'

export interface AccessibilityViolationSummary {
  readonly description: string
  readonly id: string
  readonly impact: 'serious' | 'critical'
  readonly targets: readonly string[]
}

/**
 * Runs axe against rendered DOM and returns only violations that would block a
 * beta flow. JSDOM cannot calculate layout, rendered colors, or media preload
 * completion, so those browser behaviors remain part of manual verification
 * rather than this helper.
 */
export async function findBetaBlockingAccessibilityViolations(
  context: ElementContext = document,
): Promise<readonly AccessibilityViolationSummary[]> {
  const originalGetContext = HTMLCanvasElement.prototype.getContext

  HTMLCanvasElement.prototype.getContext = function getContext(
    this: HTMLCanvasElement,
  ) {
    return {
      canvas: this,
      clearRect: () => undefined,
      fillText: () => undefined,
      getImageData: () => ({
        data: new Uint8ClampedArray([255, 0, 0, 255]),
      }),
      measureText: (text: string) => ({ width: text.length * 30 }),
    } as unknown as CanvasRenderingContext2D
  } as unknown as typeof originalGetContext

  try {
    const results = await axe.run(context, {
      preload: false,
      resultTypes: ['violations'],
      rules: {
        'color-contrast': { enabled: false },
      },
    })

    return results.violations
      .filter(
        (violation) =>
          violation.impact === 'serious' || violation.impact === 'critical',
      )
      .map((violation) => ({
        description: violation.description,
        id: violation.id,
        impact: violation.impact as 'serious' | 'critical',
        targets: violation.nodes.flatMap((node) =>
          node.target.map((target) => String(target)),
        ),
      }))
  } finally {
    HTMLCanvasElement.prototype.getContext = originalGetContext
  }
}
