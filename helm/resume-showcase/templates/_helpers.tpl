{{/*
Expand the name of the chart.
*/}}
{{- define "resume-showcase.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "resume-showcase.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "resume-showcase.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "resume-showcase.labels" -}}
helm.sh/chart: {{ include "resume-showcase.chart" . }}
{{ include "resume-showcase.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "resume-showcase.selectorLabels" -}}
app.kubernetes.io/name: {{ include "resume-showcase.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
WebSocket server labels
*/}}
{{- define "resume-showcase.websocket.labels" -}}
{{ include "resume-showcase.labels" . }}
app: {{ .Values.websocketServer.name }}
{{- end }}

{{/*
WebSocket server selector labels
*/}}
{{- define "resume-showcase.websocket.selectorLabels" -}}
{{ include "resume-showcase.selectorLabels" . }}
app: {{ .Values.websocketServer.name }}
{{- end }}

{{/*
Session provisioner labels
*/}}
{{- define "resume-showcase.provisioner.labels" -}}
{{ include "resume-showcase.labels" . }}
app: {{ .Values.sessionProvisioner.name }}
{{- end }}

{{/*
Session provisioner selector labels
*/}}
{{- define "resume-showcase.provisioner.selectorLabels" -}}
{{ include "resume-showcase.selectorLabels" . }}
app: {{ .Values.sessionProvisioner.name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "resume-showcase.serviceAccountName" -}}
{{- if .Values.rbac.create }}
{{- default .Values.rbac.serviceAccountName (printf "%s-%s" (include "resume-showcase.fullname" .) "provisioner") }}
{{- else }}
{{- default "default" .Values.rbac.serviceAccountName }}
{{- end }}
{{- end }}

{{/*
WebSocket server full image name
*/}}
{{- define "resume-showcase.websocket.image" -}}
{{- $registry := .Values.imageRegistry }}
{{- $repository := .Values.websocketServer.image.repository }}
{{- $tag := .Values.websocketServer.image.tag | default .Chart.AppVersion }}
{{- if $registry }}
{{- printf "%s/%s:%s" $registry $repository $tag }}
{{- else }}
{{- printf "%s:%s" $repository $tag }}
{{- end }}
{{- end }}

{{/*
Session provisioner full image name
*/}}
{{- define "resume-showcase.provisioner.image" -}}
{{- $registry := .Values.imageRegistry }}
{{- $repository := .Values.sessionProvisioner.image.repository }}
{{- $tag := .Values.sessionProvisioner.image.tag | default .Chart.AppVersion }}
{{- if $registry }}
{{- printf "%s/%s:%s" $registry $repository $tag }}
{{- else }}
{{- printf "%s:%s" $repository $tag }}
{{- end }}
{{- end }}
