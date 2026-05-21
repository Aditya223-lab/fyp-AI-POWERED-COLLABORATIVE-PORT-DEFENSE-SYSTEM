'use client';
// AI Model page — shows how the real RandomForest threat classifier performs.
// Data comes from public/model-card.json, which python-ml/export_model_card.py
// generates from the genuine CICIDS2017 training artifacts.

import { useEffect, useState } from 'react';

interface ClassMetric {
  name: string;
  precision: number;
  recall: number;
  f1: number;
  support: number;
}
interface Feature {
  name: string;
  importance: number;
}
interface ModelCard {
  dataset: string;
  algorithm: string;
  algorithmDetails: string;
  trainedAt: string | null;
  accuracy: number;
  macroF1: number;
  testSamples: number;
  classCount: number;
  classes: ClassMetric[];
  topFeatures: Feature[];
  confusionMatrixImage: string;
}

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

function f1Color(f1: number): string {
  if (f1 >= 0.9) return 'text-accent-green';
  if (f1 >= 0.7) return 'text-accent-yellow';
  return 'text-red-400';
}

export default function ModelPage() {
  const [card, setCard] = useState<ModelCard | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/model-card.json', { cache: 'no-store' })
      .then((r) => {
        if (!r.ok) throw new Error('not-found');
        return r.json();
      })
      .then((data: ModelCard) => setCard(data))
      .catch(() => setError(true));
  }, []);

  if (error) {
    return (
      <div className="container mx-auto px-6 py-16">
        <h1 className="font-display text-3xl font-bold">AI Model</h1>
        <div className="mt-6 px-4 py-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 text-sm text-yellow-200">
          The model card hasn&apos;t been generated yet. In the{' '}
          <code className="font-mono">python-ml</code> folder run{' '}
          <code className="font-mono">python export_model_card.py</code> (after{' '}
          <code className="font-mono">python train.py</code>), then refresh.
        </div>
      </div>
    );
  }

  if (!card) {
    return (
      <div className="container mx-auto px-6 py-16 text-white/40 text-sm">
        Loading model card…
      </div>
    );
  }

  const maxImportance = Math.max(
    ...card.topFeatures.map((f) => f.importance),
    0.0001,
  );

  return (
    <div className="container mx-auto px-6 py-10">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-widest text-accent-cyan font-medium">
          Machine learning
        </p>
        <h1 className="mt-2 font-display text-4xl font-bold">
          AI <span className="text-gradient">Model</span>
        </h1>
        <p className="mt-3 text-white/60 max-w-2xl">
          The threat classifier behind PortDefense — a {card.algorithm} trained
          on the real {card.dataset} intrusion-detection dataset. Every number
          here is measured on held-out test data the model never saw during
          training.
        </p>
      </header>

      {/* Headline metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Metric label="Test Accuracy" value={pct(card.accuracy)} accent="green" />
        <Metric label="Macro F1" value={pct(card.macroF1)} accent="cyan" />
        <Metric
          label="Test Samples"
          value={card.testSamples.toLocaleString()}
          accent="purple"
        />
        <Metric
          label="Attack Classes"
          value={String(card.classCount)}
          accent="yellow"
        />
      </div>

      {/* Algorithm */}
      <section className="glass rounded-2xl p-6 border border-white/10 mb-6">
        <h2 className="font-display font-semibold text-lg mb-2">Algorithm</h2>
        <p className="text-sm text-white/70 leading-relaxed">
          {card.algorithmDetails}
        </p>
        {card.trainedAt && (
          <p className="mt-3 text-xs text-white/40 font-mono">
            Trained {card.trainedAt}
          </p>
        )}
      </section>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Confusion matrix */}
        <section className="glass rounded-2xl p-6 border border-white/10">
          <h2 className="font-display font-semibold text-lg mb-1">
            Confusion Matrix
          </h2>
          <p className="text-xs text-white/50 mb-4">
            Rows = actual attack type, columns = predicted. A bright diagonal
            means the model rarely confuses one attack for another.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={card.confusionMatrixImage}
            alt="Confusion matrix of the threat-detection model"
            className="w-full rounded-lg border border-white/10"
          />
        </section>

        {/* Top features */}
        <section className="glass rounded-2xl p-6 border border-white/10">
          <h2 className="font-display font-semibold text-lg mb-1">
            Most Informative Features
          </h2>
          <p className="text-xs text-white/50 mb-4">
            Which network-flow measurements the Random Forest relied on most
            when splitting its decision trees.
          </p>
          {card.topFeatures.length === 0 ? (
            <p className="text-sm text-white/40">
              Feature importances unavailable (model.joblib not readable).
            </p>
          ) : (
            <div className="space-y-2.5">
              {card.topFeatures.map((f) => (
                <div key={f.name}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-white/70 font-mono truncate mr-2">
                      {f.name}
                    </span>
                    <span className="text-accent-cyan shrink-0">
                      {(f.importance * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-accent-cyan to-accent-blue"
                      style={{
                        width: `${(f.importance / maxImportance) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Per-class table */}
      <section className="glass rounded-2xl p-6 border border-white/10 mt-6">
        <h2 className="font-display font-semibold text-lg mb-1">
          Per-Class Performance
        </h2>
        <p className="text-xs text-white/50 mb-4">
          Precision, recall and F1 for each attack type. Support = number of
          test samples of that class. Low scores on tiny classes (few samples)
          are expected and pull the macro-F1 down.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white/50 text-xs uppercase tracking-wider">
                <th className="text-left py-2 pr-4">Attack type</th>
                <th className="text-right py-2 px-3">Precision</th>
                <th className="text-right py-2 px-3">Recall</th>
                <th className="text-right py-2 px-3">F1</th>
                <th className="text-right py-2 pl-3">Support</th>
              </tr>
            </thead>
            <tbody>
              {card.classes.map((c) => (
                <tr key={c.name} className="border-t border-white/5">
                  <td className="py-2 pr-4 font-medium">{c.name}</td>
                  <td className="text-right py-2 px-3 font-mono text-white/70">
                    {pct(c.precision)}
                  </td>
                  <td className="text-right py-2 px-3 font-mono text-white/70">
                    {pct(c.recall)}
                  </td>
                  <td
                    className={`text-right py-2 px-3 font-mono font-bold ${f1Color(c.f1)}`}
                  >
                    {pct(c.f1)}
                  </td>
                  <td className="text-right py-2 pl-3 font-mono text-white/40">
                    {c.support.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="mt-6 text-xs text-white/30">
        Generated from python-ml/artifacts by export_model_card.py. Re-run
        train.py then export_model_card.py to refresh after retraining.
      </p>
    </div>
  );
}

function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: 'green' | 'cyan' | 'purple' | 'yellow';
}) {
  const ring = {
    green: 'border-accent-green/30',
    cyan: 'border-accent-cyan/30',
    purple: 'border-accent-purple/30',
    yellow: 'border-accent-yellow/30',
  }[accent];
  const text = {
    green: 'text-accent-green',
    cyan: 'text-accent-cyan',
    purple: 'text-accent-purple',
    yellow: 'text-accent-yellow',
  }[accent];
  return (
    <div className={`glass rounded-2xl p-5 border ${ring} card-hover`}>
      <p className={`text-[10px] uppercase tracking-widest font-bold ${text}`}>
        {label}
      </p>
      <p className="font-display text-3xl font-bold mt-2 text-white">{value}</p>
    </div>
  );
}
