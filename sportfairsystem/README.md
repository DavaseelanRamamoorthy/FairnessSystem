# SportFairSystem

SportFairSystem is a cricket data platform that converts unstructured scorecard PDFs into structured match intelligence. It is being built to help teams move from static match documents to searchable data, team dashboards, player tracking, and eventually fairness-driven analytics.

## Core Principle

Parsing logic must remain independent of React state and UI concerns.

## What The Project Does

The current product focuses on a practical workflow:

1. Upload a cricket scorecard PDF.
2. Extract structured match data from the document.
3. Store the parsed match in Supabase.
4. Surface team and player insights through the dashboard.

This creates the foundation for deeper analytics such as player evaluation, trend analysis, and fairness scoring.

## Current Capabilities

- Parse cricket scorecard PDFs into structured match data
- Extract match metadata, innings summaries, batting stats, bowling stats, extras, and fall of wickets
- Preview parsed scorecards before saving
- Detect known vs new players during match import
- Store match records and innings data in Supabase
- Show dashboard KPIs such as matches played, win rate, top run scorer, and top wicket taker
- Display recent matches, leaderboards, and performance trend charts

## Architecture Overview

The project is built with a separation between UI, services, and data access so the parsing and business logic can evolve without being tightly coupled to the frontend.

### Main Layers

- UI layer: Next.js pages, layout, tables, charts, and scorecard views
- Service layer: PDF parsing, match insertion, querying, formatting, and stats aggregation
- Data layer: Supabase tables for matches, innings, batting stats, bowling stats, fall of wickets, and match players

## Tech Stack

- Next.js App Router
- React
- TypeScript
- Material UI
- Supabase
- PDF.js
- Recharts

## Current Product State

The project is already functional in its core ingestion and dashboard flow:

- Dashboard is implemented
- Match import and preview flow is implemented
- Match detail rendering is implemented

The broader platform is still in progress:

- Player management is still basic
- Season analytics is still limited
- Fairness scoring is not implemented yet
- Multi-team SaaS support is planned but not built

## Vision

SportFairSystem is intended to grow beyond a single-team tracker into a scalable sports intelligence platform. The long-term goal is to support multiple teams, seasons, competitions, player analytics, and a fairness scoring model that helps evaluate opportunity, contribution, and performance more objectively.

## Roadmap

### Near Term

- Strengthen player management and identity resolution
- Expand analytics beyond basic leaderboards and trends
- Improve validation around PDF ingestion and duplicate detection
- Reduce hardcoded single-team assumptions

### Next Phase

- Introduce fairness scoring logic
- Add deeper player and season analytics
- Support multiple teams and competitions
- Add an API layer and stronger admin workflows

## Summary

SportFairSystem turns cricket scorecard PDFs into structured performance intelligence. Today it is a strong foundation for match ingestion, storage, and team analytics. The long-term goal is to evolve that foundation into a fairness-focused sports intelligence platform.
