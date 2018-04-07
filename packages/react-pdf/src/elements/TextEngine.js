import warning from 'fbjs/lib/warning';
import KPLineBreaker from 'linebreaker';
import upperFirst from 'lodash.upperfirst';
import {
  Path,
  LayoutEngine,
  AttributedString,
  Container,
  TextRenderer,
} from 'textkit';
import Font from '../font';

const layoutEngine = new LayoutEngine({ lineBreaker: new KPLineBreaker() });

class TextEngine {
  constructor(element) {
    this.element = element;
    this._container = null;
    this.start = 0;
    this.end = 0;
    this.computed = false;
  }

  get container() {
    return {
      ...this._container,
      blocks: [
        {
          lines: this._container.blocks[0].lines.slice(this.start, this.end),
        },
      ],
    };
  }

  get lines() {
    return this.container ? this.container.blocks[0].lines : [];
  }

  get height() {
    if (!this._container) {
      return -1;
    }

    return this.lines.reduce((acc, line) => acc + line.height, 0);
  }

  get attributedString() {
    const fragments = [];
    const {
      color = 'black',
      fontFamily = 'Helvetica',
      fontSize = 18,
      textAlign = 'left',
      align,
      textDecoration,
      textDecorationColor,
      textDecorationStyle,
      textTransform,
    } = this.element.getComputedStyles();

    warning(
      !align,
      '"align" style prop will be deprecated on future versions. Please use "textAlign" instead in Text node',
    );

    this.element.children.forEach(child => {
      if (typeof child === 'string') {
        const obj = Font.getFont(fontFamily);
        const font = obj ? obj.data : font;
        const string = this.transformText(child, textTransform);

        fragments.push({
          string,
          attributes: {
            font,
            color,
            fontSize,
            link: this.src,
            align: textAlign,
            underline: textDecoration === 'underline',
            underlineColor: textDecorationColor || color,
            underlineStyle: textDecorationStyle,
          },
        });
      } else {
        fragments.push(...child.attributedString);
      }
    });

    return fragments;
  }

  lineIndexAtHeight(height) {
    let counter = 0;

    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i];

      if (counter + line.height > height) {
        return i;
      }

      counter += line.height;
    }

    return this.lines.length;
  }

  splice(height) {
    const result = this.clone();
    const index = this.lineIndexAtHeight(height);

    result.start = index;
    result.end = this.end;
    this.end = index;

    return result;
  }

  clone() {
    const result = new TextEngine(this.element);
    result.computed = this.computed;
    result._container = this._container;
    return result;
  }

  transformText(text, transformation) {
    switch (transformation) {
      case 'uppercase':
        return text.toUpperCase();
      case 'lowercase':
        return text.toLowerCase();
      case 'capitalize':
        return upperFirst(text);
      default:
        return text;
    }
  }

  layout(width, height) {
    if (this._container || this.computed) return;

    const path = new Path().rect(0, 0, width, height);
    const container = new Container(path);
    const string = AttributedString.fromFragments(this.attributedString);

    // Do the actual text layout
    layoutEngine.layout(string, [container]);

    this.computed = true;
    this._container = container;
    this.end = container.blocks[0].lines.length + 1;
  }

  render() {
    const margin = this.element.margin;
    const padding = this.element.padding;
    const { top, left } = this.element.getAbsoluteLayout();

    // We translate lines based on Yoga container
    const initialX = this.lines[0] ? this.lines[0].rect.y : 0;

    this.lines.forEach(line => {
      line.rect.x += left + margin.left + padding.left;
      line.rect.y += top + margin.top + padding.top - initialX;
    });

    const renderer = new TextRenderer(this.element.root, {
      outlineLines: false,
    });
    renderer.render(this.container);
  }
}

export default TextEngine;
