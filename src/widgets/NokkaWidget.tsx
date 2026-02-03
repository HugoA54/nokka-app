import React from 'react';
import {
  FlexWidget,
  TextWidget,
  SvgWidget,
} from 'react-native-android-widget';

interface NokkaWidgetProps {
  calories: number;
  calorieGoal: number;
  weekSessions: number;
}

export function NokkaWidget({ calories, calorieGoal, weekSessions }: NokkaWidgetProps) {
  const pct = calorieGoal > 0 ? Math.min(1, calories / calorieGoal) : 0;
  const barWidth = Math.round(pct * 100);

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'column',
        backgroundColor: '#16161c',
        borderRadius: 16,
        padding: 14,
        justifyContent: 'space-between',
      }}
    >
      {/* Title row */}
      <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <TextWidget
          text="NOKKA"
          style={{ color: '#c8f060', fontSize: 11, fontWeight: 'bold' }}
        />
      </FlexWidget>

      {/* Calories */}
      <FlexWidget style={{ flexDirection: 'column', gap: 4 }}>
        <TextWidget
          text={`${calories} kcal`}
          style={{ color: '#f0f0f0', fontSize: 22, fontWeight: 'bold' }}
        />
        <TextWidget
          text={`/ ${calorieGoal} kcal objectif`}
          style={{ color: '#7a7a90', fontSize: 11 }}
        />

        {/* Progress bar background */}
        <FlexWidget
          style={{
            height: 5,
            width: 'match_parent',
            backgroundColor: '#2a2a35',
            borderRadius: 3,
          }}
        >
          {/* Progress bar fill */}
          <FlexWidget
            style={{
              height: 5,
              width: `${barWidth}%`,
              backgroundColor: '#c8f060',
              borderRadius: 3,
            }}
          />
        </FlexWidget>
      </FlexWidget>

      {/* Sessions this week */}
      <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <TextWidget text="🏋️" style={{ fontSize: 12 }} />
        <TextWidget
          text={`${weekSessions} séance${weekSessions > 1 ? 's' : ''} cette semaine`}
          style={{ color: '#7a7a90', fontSize: 11 }}
        />
      </FlexWidget>
    </FlexWidget>
  );
}
