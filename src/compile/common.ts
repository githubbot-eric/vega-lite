import {SignalRef, Text} from 'vega';
import {array, stringValue} from 'vega-util';
import {AxisConfig} from '../axis';
import {FieldDefBase, FieldRefOption, OrderFieldDef, vgField} from '../channeldef';
import {Config, StyleConfigIndex} from '../config';
import {MarkConfig, MarkDef} from '../mark';
import {SortFields} from '../sort';
import {isText} from '../title';
import {deepEqual, getFirstDefined} from '../util';
import {isSignalRef, VgEncodeChannel, VgEncodeEntry, VgValueRef} from '../vega.schema';
import {AxisComponentProps} from './axis/component';
import {Explicit} from './split';
import {UnitModel} from './unit';

export const BIN_RANGE_DELIMITER = ' \u2013 ';

export function signalOrValueRef<T>(value: T | SignalRef): {value: T} | SignalRef {
  if (isSignalRef(value)) {
    return value;
  }
  return value !== undefined ? {value} : undefined;
}

export function exprFromValueOrSignalRef(ref: VgValueRef | SignalRef): string {
  if (isSignalRef(ref)) {
    return ref.signal;
  }
  return stringValue(ref.value);
}

export function signalOrStringValue(v: SignalRef | any) {
  if (isSignalRef(v)) {
    return v.signal;
  }
  return stringValue(v);
}

export function applyMarkConfig(e: VgEncodeEntry, model: UnitModel, propsList: (keyof MarkConfig)[]) {
  for (const property of propsList) {
    const value = getMarkConfig(property, model.markDef, model.config);
    if (value !== undefined) {
      e[property] = signalOrValueRef(value);
    }
  }
  return e;
}

export function getStyles(mark: MarkDef): string[] {
  return [].concat(mark.type, mark.style ?? []);
}

export function getMarkPropOrConfig<P extends keyof MarkDef>(
  channel: P,
  mark: MarkDef,
  config: Config,
  opt: {
    vgChannel?: VgEncodeChannel;
    ignoreVgConfig?: boolean;
  } = {}
): MarkDef[P] {
  const {vgChannel, ignoreVgConfig} = opt;
  if (vgChannel && mark[vgChannel] !== undefined) {
    return mark[vgChannel];
  } else if (mark[channel] !== undefined) {
    return mark[channel];
  } else if (ignoreVgConfig && (!vgChannel || vgChannel === channel)) {
    return undefined;
  }

  return getMarkConfig(channel, mark, config, opt);
}

/**
 * Return property value from style or mark specific config property if exists.
 * Otherwise, return general mark specific config.
 */
export function getMarkConfig<P extends keyof MarkDef>(
  channel: P,
  mark: MarkDef,
  config: Config,
  {vgChannel}: {vgChannel?: VgEncodeChannel} = {}
): MarkDef[P] {
  return getFirstDefined<MarkDef[P]>(
    // style config has highest precedence
    vgChannel ? getMarkStyleConfig(channel, mark, config.style) : undefined,
    getMarkStyleConfig(channel, mark, config.style),
    // then mark-specific config
    vgChannel ? config[mark.type][vgChannel] : undefined,

    config[mark.type][channel as any], // Need to cast because MarkDef doesn't perfectly match with AnyMarkConfig, but if the type isn't available, we'll get nothing here, which is fine

    // If there is vgChannel, skip vl channel.
    // For example, vl size for text is vg fontSize, but config.mark.size is only for point size.
    vgChannel ? config.mark[vgChannel] : config.mark[channel as any] // Need to cast for the same reason as above
  );
}

export function getMarkStyleConfig<P extends keyof MarkDef>(
  prop: P,
  mark: MarkDef,
  styleConfigIndex: StyleConfigIndex
) {
  return getStyleConfig(prop, getStyles(mark), styleConfigIndex);
}

export function getStyleConfig<P extends keyof MarkDef | keyof AxisConfig>(
  p: P,
  styles: string | string[],
  styleConfigIndex: StyleConfigIndex
) {
  styles = array(styles);
  let value;
  for (const style of styles) {
    const styleConfig = styleConfigIndex[style];

    if (styleConfig && styleConfig[p as string] !== undefined) {
      value = styleConfig[p as string];
    }
  }
  return value;
}

/**
 * Return Vega sort parameters (tuple of field and order).
 */
export function sortParams(
  orderDef: OrderFieldDef<string> | OrderFieldDef<string>[],
  fieldRefOption?: FieldRefOption
): SortFields {
  return array(orderDef).reduce(
    (s, orderChannelDef) => {
      s.field.push(vgField(orderChannelDef, fieldRefOption));
      s.order.push(orderChannelDef.sort ?? 'ascending');
      return s;
    },
    {field: [], order: []}
  );
}

export type AxisTitleComponent = AxisComponentProps['title'];

export function mergeTitleFieldDefs(f1: readonly FieldDefBase<string>[], f2: readonly FieldDefBase<string>[]) {
  const merged = [...f1];

  f2.forEach(fdToMerge => {
    for (const fieldDef1 of merged) {
      // If already exists, no need to append to merged array
      if (deepEqual(fieldDef1, fdToMerge)) {
        return;
      }
    }
    merged.push(fdToMerge);
  });
  return merged;
}

export function mergeTitle(title1: Text | SignalRef, title2: Text | SignalRef) {
  if (deepEqual(title1, title2) || !title2) {
    // if titles are the same or title2 is falsy
    return title1;
  } else if (!title1) {
    // if title1 is falsy
    return title2;
  } else {
    return [...array(title1), ...array(title2)].join(', ');
  }
}

export function mergeTitleComponent(v1: Explicit<AxisTitleComponent>, v2: Explicit<AxisTitleComponent>) {
  const v1Val = v1.value;
  const v2Val = v2.value;

  if (v1Val == null || v2Val === null) {
    return {
      explicit: v1.explicit,
      value: null
    };
  } else if ((isText(v1Val) || isSignalRef(v1Val)) && (isText(v2Val) || isSignalRef(v2Val))) {
    return {
      explicit: v1.explicit,
      value: mergeTitle(v1Val, v2Val)
    };
  } else if (isText(v1Val) || isSignalRef(v1Val)) {
    return {
      explicit: v1.explicit,
      value: v1Val
    };
  } else if (isText(v2Val) || isSignalRef(v2Val)) {
    return {
      explicit: v1.explicit,
      value: v2Val
    };
  } else if (!isText(v1Val) && !isSignalRef(v1Val) && !isText(v2Val) && !isSignalRef(v2Val)) {
    return {
      explicit: v1.explicit,
      value: mergeTitleFieldDefs(v1Val, v2Val)
    };
  }
  /* istanbul ignore next: Condition should not happen -- only for warning in development. */
  throw new Error('It should never reach here');
}
