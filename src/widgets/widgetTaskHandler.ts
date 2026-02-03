import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { NokkaWidget } from './NokkaWidget';

const WIDGET_DATA_KEY = 'nokka_widget_data';

export interface WidgetData {
  calories: number;
  calorieGoal: number;
  weekSessions: number;
}

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED': {
      const raw = await AsyncStorage.getItem(WIDGET_DATA_KEY);
      const data: WidgetData = raw
        ? JSON.parse(raw)
        : { calories: 0, calorieGoal: 2000, weekSessions: 0 };

      props.renderWidget(
        React.createElement(NokkaWidget, {
          calories: data.calories,
          calorieGoal: data.calorieGoal,
          weekSessions: data.weekSessions,
        })
      );
      break;
    }

    default:
      break;
  }
}

export async function saveWidgetData(data: WidgetData): Promise<void> {
  await AsyncStorage.setItem(WIDGET_DATA_KEY, JSON.stringify(data));
}
