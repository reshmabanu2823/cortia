# CORTIA — Presentation Report

## Project overview

CORTIA is a local research workspace for EEG signal analysis and separate MRI image classification. It combines signal acquisition, frequency analysis, recording history, baseline statistics, image classification, explanatory chat, and downloadable reports in one interface.

The project supports research and demonstrations. It does not provide clinically validated diagnoses, attention scores, stress measurements, or treatment recommendations.

## Problem and objective

Raw EEG samples and MRI model outputs are difficult to interpret without context. CORTIA organizes them into traceable recordings, charts, quality decisions, class probabilities, and readable summaries. Its objective is to make analysis easier to inspect, compare, explain, and document.

EEG describes recorded electrical signal activity over time. MRI classification analyzes a supplied image. These remain separate analysis workflows with separate report content; the application does not use a fusion model.

## Architecture

| Layer | Implementation | Purpose |
| --- | --- | --- |
| Frontend | React, TypeScript, Vite, CSS, Recharts, Lucide | Pages, charts, controls, and chat |
| API | Python, FastAPI | Authentication, records, acquisition, inference, and exports |
| Live transport | WebSockets | Streaming recorded device samples to the interface |
| Persistence | SQLAlchemy and SQLite | Accounts, sessions, features, baselines, MRI predictions, and conversations |
| Signal processing | NumPy and SciPy | Filtering, spectra, band integration, and statistics |
| MRI inference | TensorFlow Lite | Four-class image prediction |
| Documents | ReportLab and python-docx | Watermarked PDF and editable Word exports |

Raw EEG samples are stored as CSV files. Uploaded images and generated analysis metadata are stored locally. Optional external AI requests use a configured service, so the chatbot should not be described as entirely offline.

## EEG workflow

1. Connect the supported Chords UNO-R4 device over a serial port.
2. Choose the configured channel and firmware sampling rate: 250 or 500 Hz.
3. Validate the device handshake and decode incoming packets.
4. Check packet counters, duplicate samples, corruption, and acquisition gaps.
5. Stream samples through WebSockets and save raw recordings with timestamps.
6. Divide the signal into eight-second windows.
7. Reject unsuitable windows using quality heuristics.
8. Filter usable windows and calculate spectra, band powers, and ratios.
9. Store calculated features for review, comparison, and report generation.

The decoder handles six-channel packets, but the application analyzes one selected channel. Serial communication uses 230400 baud. Device and channel settings must match the firmware.

## EEG calculations

The pipeline checks for flatline, clipping, missing samples, and abrupt steps. These are exploratory quality checks, not guaranteed artifact removal.

Usable windows pass through a fourth-order Butterworth bandpass from 0.5 to 29.5 Hz. Welch power spectral density estimates how signal power is distributed by frequency. FFT amplitude data is also available.

| Band | Implemented range |
| --- | --- |
| Delta | 0.5–4 Hz |
| Theta | 4–8 Hz |
| Alpha | 8–13 Hz |
| Beta | 13–29.5 Hz |

Band power is integrated from the spectrum. Relative power is band power divided by the sum of the four band powers. Multiplying it by 100 gives a percentage. Ratios include theta/beta, alpha/theta, and beta/alpha. Ratios with unreliable denominators are withheld.

Amplitude is not calibrated in microvolts. Power uses ADC-count-squared units. Gamma is not analyzed. Frequency patterns alone do not establish a person's mental state or medical condition.

## Baselines

A personal baseline combines at least three completed, comparable recordings, each containing at least three usable windows. Real recordings must match task, eye condition, montage, and acquisition configuration.

Each recording contributes one feature mean, preventing longer recordings from dominating the baseline. The application calculates mean, median, and sample standard deviation. Baseline versions preserve their original cohorts. Where a matching reference exists, a z-score describes how far a feature lies from the reference mean in standard-deviation units.

The interface explains band percentages and variation in plain language, with exact statistics available separately. An exploratory three-standard-deviation flag is not a clinical threshold.

The demo also permits comparison of generated cases with different conditions. Such results are marked as demo comparisons and are not personal references for measured recordings.

## MRI workflow

The user uploads an image, the server validates and normalizes the decoded pixels, and the configured preprocessing contract resizes the image to 224 × 224 RGB. Normalization follows the model manifest.

The bundled model family uses a MobileNetV2 feature extractor and classifier. TensorFlow Lite inference returns scores for glioma, meningioma, pituitary tumor, and the dataset's no-tumor class. The interface shows the predicted class and the class-score distribution.

Where model compatibility and attribution checks permit, Grad-CAM highlights image regions that influenced the prediction. It is not lesion segmentation, a tumor boundary, or a measurement of severity. Model hashes preserve artifact provenance. No new training is performed during ordinary application use.

## Interface and supporting features

- A branded splashscreen replays on refresh and can be skipped.
- Overview shows available recordings, status, and recent activity.
- Live EEG provides device setup and recording controls.
- Brainwaves provides stored-window and spectral inspection.
- Baselines provides reference calculation and readable statistical summaries.
- MRI Analysis provides image upload, prediction history, and attribution where available.
- History provides recording review, comparison, and exports.
- AI Insights provides contextual chat and recording explanations. Responses appear progressively, with the input kept visible.
- Notifications shows recent recording, MRI, and baseline activity with timestamps. It has no reminder-entry form.

EEG and MRI each support separate PDF and Word reports with a visible CORTIA watermark. Raw EEG CSV and structured JSON exports support further inspection.

## Demonstration data and verification

Seven generated EEG cases cover eyes-closed rest, reading, quiet rest, slow-wave content, mixed bands, interrupted contact, and clipping. These are dated over the previous week and processed by the actual analysis pipeline. Each contains 48000 samples at 500 Hz: 96 seconds split into twelve windows. Artifact cases demonstrate excluded windows rather than fabricated valid results.

The cases are available in the reshma and reshmabanu demo accounts. Their calculated values demonstrate software behavior, not measurements from those users.

Automated checks cover processing fixtures, case generation, selected-case baseline calculations, document downloads, ownership checks, and report separation. Browser checks cover core navigation and presentation workflows. This testing does not establish medical accuracy or successful physical EEG acquisition.

## Important limits

Current login accepts an existing username without verifying a password, as configured for the demo. It is not suitable access protection for sensitive records. Owner-scoped APIs and session cookies do not compensate for passwordless impersonation.

Physical EEG hardware capture has not been verified in this session. MRI scores are model outputs, not calibrated clinical confidence. The no-tumor class does not certify health. Clinical validation and a verified accuracy figure are not established. External chatbot availability depends on its configured service.

## Suggested presentation sequence

Start with the problem and architecture. Show Overview, explain the EEG pipeline, open a demo case, calculate a demo baseline, and explain the readable summary. Then demonstrate MRI as a separate workflow, followed by each workflow's report download. Finish with chat, recent activity, and the validation limits.

## Opening statement

“CORTIA is a research workspace that makes EEG signals and MRI model outputs easier to inspect and explain. It provides traceable signal calculations, quality checks, baseline comparisons, separate image classification, and watermarked reports. Our demonstration validates software workflows; it does not claim clinical diagnosis.”
